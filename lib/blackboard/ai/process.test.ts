import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseTitleDate } from '@/lib/blackboard/dates'
import type { AssignmentLite, ExistingKeyDate } from './grounding'
import type { AiCall, AiRequest } from './pipeline'

vi.mock('server-only', () => ({}))

const { processNext } = await import('./process')
type WorkStore = import('./process').WorkStore
type WorkState = import('./process').WorkState
type ContentLite = import('./process').ContentLite

const NOW = () => new Date('2026-11-12T12:00:00Z')
const C1 = 'course-1'
const ORG = 'course-org'

// ------------------------------------------------------------- the store --

function content(id: string, title: string, over: Partial<ContentLite> = {}): ContentLite {
  return {
    id,
    course_id: C1,
    kind: 'document',
    title,
    path: [],
    body_text: null,
    links: [],
    body_hash: `hash-${id}-1`,
    available_from: null,
    ...over,
  }
}

interface Db {
  state: WorkState
  docText: Record<string, string>
  assignments: AssignmentLite[]
  keyDates: ExistingKeyDate[]
  writes: number
}

function seed(): Db {
  const plain = Array.from({ length: 40 }, (_, i) => content(`plain-${i}`, `Lecture ${i + 1} slides`))
  return {
    state: {
      courses: [
        { id: C1, module_code: 'GEOG1061', name: 'Geographies of Border Crises', term: '2026' },
        { id: ORG, module_code: null, name: 'Library skills', term: '2026' },
      ],
      content: [
        content('post', 'Formative Discussion Post I, due 13 November'),
        content('essay', 'Formative Essay due 24th November 2026 by 2pm'),
        content('summative', 'Summative Essay due 16th February 2027 by 2pm (CMP002/ESFN41)', { kind: 'link' }),
        content('borders', 'Monday, 9 November: Borders and Migration (Prof Lauren Martin)'),
        content('office', 'Tuesday, 17 November: Drop-in Office Hours 11:00-12.00 with Prof Martin'),
        content('handbook', 'Module Handbook', { kind: 'file' }),
        ...plain,
        // Org course: never processed.
        content('org-1', 'Library induction due 20 November', { course_id: ORG }),
      ],
      contentAi: [],
      announcements: [
        {
          id: 'ann-reading',
          course_id: C1,
          title: 'Reading for the tutorials next week',
          body_text: 'Hello all. Please read chapter 2 before the tutorial on Tuesday 17 November. See you there',
          posted_at: '2026-11-10T09:00:00Z',
          body_hash: 'ann-reading-1',
          ai_hash: null,
        },
        {
          id: 'ann-welcome',
          course_id: C1,
          title: 'Welcome to the module',
          body_text: 'Hello everyone, welcome. The reading list is on Talis.',
          posted_at: '2026-10-01T09:00:00Z',
          body_hash: 'ann-welcome-1',
          ai_hash: null,
        },
      ],
      documents: [{ id: 'doc-1', content_id: 'handbook', file_name: 'Handbook.pdf', text_hash: 'doc-1-1', ai_hash: null }],
    },
    docText: {
      'doc-1': 'Module handbook\nContacts and aims.\fAssessment\nThe summative essay is due 16 February 2027 at 2pm. Word limit 2500.',
    },
    assignments: [{ id: 'as-1', course_id: C1, title: 'Summative Essay', due_at: '2027-02-16T14:00:00Z' }],
    keyDates: [],
    writes: 0,
  }
}

function memoryStore(db: Db): WorkStore {
  let nextId = 1
  return {
    async loadState() {
      return structuredClone(db.state)
    },
    async loadDocumentText(id) {
      return db.docText[id] ?? null
    },
    async loadAssignments(courseId) {
      return db.assignments.filter((a) => a.course_id === courseId)
    },
    async loadKeyDates(courseId) {
      return structuredClone(db.keyDates.filter((k) => k.course_id === courseId))
    },
    async saveClassifications(rows) {
      db.writes++
      for (const r of rows) {
        const row = db.state.contentAi.find((a) => a.content_id === r.content_id)
        if (row) row.classified_hash = r.classified_hash
        else db.state.contentAi.push({ content_id: r.content_id, classified_hash: r.classified_hash, extracted_hash: null })
      }
    },
    async markContentExtracted(rows) {
      db.writes++
      for (const r of rows) {
        const row = db.state.contentAi.find((a) => a.content_id === r.content_id)
        if (row) row.extracted_hash = r.extracted_hash
        else db.state.contentAi.push({ content_id: r.content_id, classified_hash: null, extracted_hash: r.extracted_hash })
      }
    },
    async markAnnouncements(rows) {
      db.writes++
      for (const r of rows) db.state.announcements.find((a) => a.id === r.id)!.ai_hash = r.ai_hash
    },
    async markDocument(id, aiHash) {
      db.writes++
      db.state.documents.find((d) => d.id === id)!.ai_hash = aiHash
    },
    async applyKeyDates(merge) {
      db.writes++
      const before = db.keyDates.length
      db.keyDates = db.keyDates.filter((k) => !(merge.remove.includes(k.id) && k.status === 'suggested'))
      const removed = before - db.keyDates.length
      for (const u of merge.update) Object.assign(db.keyDates.find((k) => k.id === u.id)!, u.patch)
      let added = 0
      for (const r of merge.insert) {
        if (db.keyDates.some((k) => k.fingerprint === r.fingerprint)) continue
        db.keyDates.push({ ...r, id: `kd-${nextId++}` })
        added++
      }
      return { added, updated: merge.update.length, removed }
    },
    async removeSuggestedFrom(kind, ids) {
      const col = `${kind}_id` as 'announcement_id' | 'content_id' | 'document_id'
      const before = db.keyDates.length
      db.keyDates = db.keyDates.filter((k) => !(k.status === 'suggested' && ids.includes(k[col] as string)))
      return before - db.keyDates.length
    },
  }
}

// ------------------------------------------------------------ the fake AI --

interface Block {
  index: number
  title: string
  text: string
}

function blocks(prompt: string): Block[] {
  const out: Block[] = []
  const re = /<<<SOURCE (\d+) [^\n]*\nTITLE: ([^\n]*)\nTEXT:\n([\s\S]*?)\nSOURCE \1>>>/g
  for (let m = re.exec(prompt); m; m = re.exec(prompt)) out.push({ index: Number(m[1]), title: m[2], text: m[3] })
  return out
}

/** Classifies everything as 'other'; extracts every sentence with "due" or "before" and a date. */
function fakeAi() {
  const requests: AiRequest[] = []
  const ai: AiCall = async (request) => {
    requests.push(request)
    if (request.feature === 'bb_classify') {
      const count = (request.prompt.match(/^\[\d+\] kind:/gm) ?? []).length
      return { model: 'fake-lite', data: { items: Array.from({ length: count }, (_, i) => ({ i: i + 1, role: 'other' })) } }
    }
    const items = blocks(request.prompt).flatMap((b) =>
      `${b.title}. ${b.text}`
        .split(/(?<=\.)\s+|\n/)
        .map((s) => s.replace(/\.$/, '').trim())
        .filter((s) => /\b(due|before)\b/i.test(s))
        .flatMap((s) => {
          const date = parseTitleDate(s, { yearStart: 2026 })
          if (!date) return []
          return [
            {
              source: b.index,
              title: `Do ${s.slice(0, 60)}`,
              category: /summative/i.test(s) ? 'summative' : /tutorial/i.test(s) ? 'tutorial' : 'formative',
              due_on: date.date,
              due_time: date.time ?? null,
              quote: s,
            },
          ]
        })
    )
    return { model: 'fake-flash', data: { items } }
  }
  return { ai, requests }
}

const SUPABASE = {} as SupabaseClient

async function drain(db: Db, ai: AiCall, max = 20) {
  const results = []
  for (let i = 0; i < max; i++) {
    const r = await processNext(SUPABASE, { ai, userId: 'u1', now: NOW, store: memoryStore(db) })
    results.push(r)
    if (r.remaining === 0 || r.error || r.budgetHit) break
  }
  return results
}

// ----------------------------------------------------------------- tests --

describe('processNext', () => {
  it('processes everything once, then makes zero calls on an unchanged second pass', async () => {
    const db = seed()
    const { ai, requests } = fakeAi()

    const first = await drain(db, ai)
    expect(first.map((r) => r.unit)).toEqual(['classify', 'classify', 'announcements', 'content', 'document'])
    expect(first.map((r) => r.remaining)).toEqual([4, 3, 2, 1, 0])
    expect(first.every((r) => !r.error)).toBe(true)

    // 46 module items → 40 + 6 classify; 1 announcement with a date signal;
    // one content batch of the 5 items with a signal; one handbook chunk.
    expect(requests.map((r) => r.feature)).toEqual([
      'bb_classify',
      'bb_classify',
      'bb_extract_announcement',
      'bb_extract_content',
      'bb_extract_document',
    ])
    expect(requests[0].tier).toBe('fast')
    expect(requests[2]).toMatchObject({ tier: 'smart', thinking: true })
    expect(first[0].skippedNoSignal).toBe(41 + 1) // 41 quiet content items + the welcome announcement
    expect(requests.some((r) => r.prompt.includes('Library induction'))).toBe(false)
    expect(requests[3].prompt).not.toContain('Lecture 1 slides')
    expect(requests[2].prompt).not.toContain('Welcome to the module')

    // Four key dates; the handbook's summative essay collapses into the title's.
    const byDay = Object.fromEntries(db.keyDates.map((k) => [k.due_on, k]))
    expect(Object.keys(byDay).sort()).toEqual(['2026-11-13', '2026-11-17', '2026-11-24', '2027-02-16'])
    expect(byDay['2027-02-16']).toMatchObject({ assignment_id: 'as-1', content_id: 'summative', category: 'summative', due_at: '2027-02-16T14:00:00.000Z' })
    expect(byDay['2026-11-17']).toMatchObject({ announcement_id: 'ann-reading', category: 'tutorial', status: 'suggested' })
    expect(byDay['2026-11-24'].due_at).toBe('2026-11-24T14:00:00.000Z')
    expect(db.keyDates.every((k) => [k.announcement_id, k.content_id, k.document_id].filter(Boolean).length === 1)).toBe(true)

    // Every hash advanced.
    expect(db.state.contentAi.filter((a) => a.classified_hash && a.extracted_hash)).toHaveLength(46)
    expect(db.state.announcements.every((a) => a.ai_hash === a.body_hash)).toBe(true)
    expect(db.state.documents[0].ai_hash).toBe('doc-1-1')

    const calls = requests.length
    const writes = db.writes
    const second = await processNext(SUPABASE, { ai, userId: 'u1', now: NOW, store: memoryStore(db) })
    expect(second).toMatchObject({ unit: 'none', calls: 0, remaining: 0, processed: 0, added: 0, budgetHit: false })
    expect(second.skippedUnchanged).toBe(46 + 46 + 2 + 1)
    expect(requests.length).toBe(calls)
    expect(db.writes).toBe(writes)
  })

  it('sends exactly one call containing only the one changed item', async () => {
    const db = seed()
    const { ai, requests } = fakeAi()
    await drain(db, ai)
    const before = requests.length

    db.state.content.find((c) => c.id === 'plain-7')!.body_hash = 'hash-plain-7-2'
    const results = await drain(db, ai)
    const sent = requests.slice(before)
    expect(sent).toHaveLength(1)
    expect(sent[0].feature).toBe('bb_classify')
    expect(sent[0].prompt).toContain('[1] kind:')
    expect(sent[0].prompt).not.toContain('[2] kind:')
    expect(sent[0].prompt).toContain('Lecture 8 slides')
    expect(results[0].skippedNoSignal).toBe(1)
    expect(results[results.length - 1].remaining).toBe(0)
  })

  it('re-extracts a changed deadline item alone, and never brings back a dismissed or overwrites a confirmed date', async () => {
    const db = seed()
    const { ai, requests } = fakeAi()
    await drain(db, ai)

    const essay = db.keyDates.find((k) => k.content_id === 'essay')!
    essay.status = 'dismissed'
    const post = db.keyDates.find((k) => k.content_id === 'post')!
    Object.assign(post, { status: 'confirmed', due_on: '2026-11-14', title: 'My post' })

    for (const id of ['essay', 'post']) {
      const c = db.state.content.find((x) => x.id === id)!
      c.body_hash = `${c.body_hash}-edited`
      c.body_text = 'Use the discussion board.'
    }
    const before = requests.length
    await drain(db, ai)
    const sent = requests.slice(before)
    expect(sent.map((r) => r.feature)).toEqual(['bb_classify', 'bb_extract_content'])
    expect(blocks(sent[1].prompt).map((b) => b.title)).toEqual([
      'Formative Discussion Post I, due 13 November',
      'Formative Essay due 24th November 2026 by 2pm',
    ])

    expect(db.keyDates.filter((k) => k.content_id === 'essay')).toEqual([expect.objectContaining({ status: 'dismissed' })])
    expect(db.keyDates.filter((k) => k.content_id === 'post')).toEqual([
      expect.objectContaining({ status: 'confirmed', due_on: '2026-11-14', title: 'My post' }),
    ])
    expect(db.keyDates).toHaveLength(4)
  })

  it('removes a stale suggestion when its source no longer has a date', async () => {
    const db = seed()
    const { ai } = fakeAi()
    await drain(db, ai)
    const ann = db.state.announcements.find((a) => a.id === 'ann-reading')!
    Object.assign(ann, { body_text: 'Tutorials are cancelled.', title: 'Update', body_hash: 'ann-reading-2' })
    const [r] = await drain(db, ai)
    expect(r).toMatchObject({ unit: 'none', calls: 0, skippedNoSignal: 1, removed: 1 })
    expect(db.keyDates.some((k) => k.announcement_id === 'ann-reading')).toBe(false)
    expect(ann.ai_hash).toBe('ann-reading-2')
  })

  it('leaves hashes alone on failure, retries 3 times, then reports instead of looping', async () => {
    const db = seed()
    let calls = 0
    const failing: AiCall = async () => {
      calls++
      throw new Error('model exploded')
    }
    const r = await processNext(SUPABASE, { ai: failing, userId: 'u1', now: NOW, store: memoryStore(db) })
    expect(r).toMatchObject({ unit: 'classify', error: 'model exploded', calls: 3, remaining: 5 })
    expect(calls).toBe(3)
    expect(db.state.contentAi.some((a) => a.classified_hash)).toBe(false)

    // A flaky call succeeds on retry and the unit completes.
    const { ai } = fakeAi()
    let n = 0
    const flaky: AiCall = async (req) => {
      if (n++ === 0) throw new Error('blip')
      return ai(req)
    }
    const ok = await processNext(SUPABASE, { ai: flaky, userId: 'u1', now: NOW, store: memoryStore(db) })
    expect(ok).toMatchObject({ unit: 'classify', calls: 2, processed: 40, remaining: 4 })
    expect(ok.error).toBeUndefined()
  })

  it('treats invalid model output as a failure (nothing written, hash unchanged)', async () => {
    const db = seed()
    const junk: AiCall = async () => ({ model: 'x', data: { nope: true } })
    const r = await processNext(SUPABASE, { ai: junk, userId: 'u1', now: NOW, store: memoryStore(db) })
    expect(r.error).toBeTruthy()
    expect(db.state.contentAi.some((a) => a.classified_hash)).toBe(false)
  })

  it('stops on the budget with nothing written', async () => {
    const db = seed()
    const budget: AiCall = async () => {
      const err = new Error('AI budget reached for today.')
      err.name = 'AiBudgetExceededError'
      throw err
    }
    const r = await processNext(SUPABASE, { ai: budget, userId: 'u1', now: NOW, store: memoryStore(db) })
    expect(r).toMatchObject({ unit: 'classify', budgetHit: true, calls: 1, remaining: 5 })
    expect(r.error).toBeUndefined()
    expect(db.state.contentAi.some((a) => a.classified_hash)).toBe(false)
  })

  it("doesn't start a document that needs more calls than the budget has left", async () => {
    const db = seed()
    const { ai, requests } = fakeAi()
    // Everything but the document done.
    await drain(db, ai)
    db.state.documents[0].ai_hash = null
    const before = requests.length
    const r = await processNext(SUPABASE, { ai, userId: 'u1', now: NOW, store: memoryStore(db), budgetRemaining: async () => 0 })
    expect(r).toMatchObject({ unit: 'document', budgetHit: true, calls: 0, remaining: 1 })
    expect(requests.length).toBe(before)
    expect(db.state.documents[0].ai_hash).toBeNull()
  })

  it('cuts a long document at 12 chunks and says so', async () => {
    const db = seed()
    const { ai, requests } = fakeAi()
    await drain(db, ai)
    const page = (n: number) => `Page ${n}. Task ${n} is due ${(n % 28) + 1} March 2027. ` + 'filler words here '.repeat(300)
    db.docText['doc-1'] = Array.from({ length: 40 }, (_, i) => page(i + 1)).join('\f')
    db.state.documents[0].text_hash = 'doc-1-2'
    const before = requests.length
    const [r] = await drain(db, ai)
    expect(r.unit).toBe('document')
    expect(requests.length - before).toBe(12)
    expect(r.note).toMatch(/first 12 of/)
    expect(db.state.documents[0].ai_hash).toBe('doc-1-2')
  })
})
