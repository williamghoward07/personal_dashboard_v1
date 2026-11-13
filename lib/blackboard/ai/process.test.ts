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

// Key date ids stay unique across units (each unit gets a fresh store).
let nextId = 1

function memoryStore(db: Db): WorkStore {
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
    async markClassified(rows) {
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
    async loadSuggestedFrom(kind, ids) {
      const col = `${kind}_id` as 'announcement_id' | 'content_id' | 'document_id'
      return structuredClone(db.keyDates.filter((k) => k.status === 'suggested' && ids.includes(k[col] as string)))
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

    // Four deadlines. The handbook's wording of the summative essay isn't
    // strictly the item title's, so it is kept as its own row (a duplicate
    // rather than a risk of a loss); both are linked to the official
    // assignment, which the work list shows once.
    const byDay = Object.fromEntries(db.keyDates.map((k) => [k.due_on, k]))
    expect(Object.keys(byDay).sort()).toEqual(['2026-11-13', '2026-11-17', '2026-11-24', '2027-02-16'])
    const summative = db.keyDates.filter((k) => k.due_on === '2027-02-16')
    expect(summative.map((k) => k.content_id ?? k.document_id).sort()).toEqual(['doc-1', 'summative'])
    for (const k of summative) expect(k).toMatchObject({ assignment_id: 'as-1', category: 'summative', due_at: '2027-02-16T14:00:00.000Z' })
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
    expect(db.keyDates).toHaveLength(5)
  })

  it('removes a stale suggestion when its source no longer has a date, and re-reads the other sources that mention that day', async () => {
    const db = seed()
    const { ai, requests } = fakeAi()
    await drain(db, ai)
    const ann = db.state.announcements.find((a) => a.id === 'ann-reading')!
    Object.assign(ann, { body_text: 'Tutorials are cancelled.', title: 'Update', body_hash: 'ann-reading-2' })
    const before = requests.length
    const [r, next, ...rest] = await drain(db, ai)
    expect(r).toMatchObject({ unit: 'none', calls: 0, skippedNoSignal: 1, removed: 1, requeued: 1, remaining: 1 })
    expect(db.keyDates.some((k) => k.announcement_id === 'ann-reading')).toBe(false)
    expect(ann.ai_hash).toBe('ann-reading-2')
    // "Tuesday, 17 November: Drop-in Office Hours" mentions the day: read once more.
    expect(next).toMatchObject({ unit: 'content', calls: 1, added: 0, remaining: 0 })
    expect(blocks(requests[before].prompt).map((b) => b.title)).toEqual(['Tuesday, 17 November: Drop-in Office Hours 11:00-12.00 with Prof Martin'])
    expect(rest).toEqual([])
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

  it('treats invalid model output as a failure of that batch: never "nothing found", never a real hash', async () => {
    const db = seed()
    let calls = 0
    const junk: AiCall = async () => {
      calls++
      return { model: 'x', data: { nope: true } }
    }
    const r = await processNext(SUPABASE, { ai: junk, userId: 'u1', now: NOW, store: memoryStore(db) })
    // One retry only (an unusable reply costs tokens), then the 40 rows are split.
    expect(r).toMatchObject({ unit: 'classify', calls: 2, failed: 0, remaining: 4 + 40 })
    expect(r.error).toBeUndefined()
    expect(r.note).toMatch(/one at a time/)
    expect(calls).toBe(2)
    const marked = db.state.contentAi.filter((a) => a.classified_hash?.startsWith('retry:'))
    expect(marked).toHaveLength(40)
    expect(db.state.contentAi.some((a) => a.classified_hash && !a.classified_hash.includes(':'))).toBe(false)
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

  // ------------------------------------------------ finding 7: long documents

  it('reads a long document 12 signal-bearing parts per unit, keeping earlier finds, and says so', async () => {
    const db = seed()
    const { ai, requests } = fakeAi()
    await drain(db, ai)
    const oldDocRow = db.keyDates.find((k) => k.document_id === 'doc-1')!
    expect(oldDocRow).toBeTruthy()

    const page = (n: number) => `Page ${n}. Task ${n} is due ${(n % 28) + 1} March 2027. ` + 'filler words here '.repeat(300)
    const quiet = (n: number) => `Notes ${n}. ` + 'filler words here '.repeat(300)
    // 40 pages with a deadline, then 40 with nothing dated (never sent, never counted).
    db.docText['doc-1'] = [...Array.from({ length: 40 }, (_, i) => page(i + 1)), ...Array.from({ length: 40 }, (_, i) => quiet(i + 1))].join('\f')
    db.state.documents[0].text_hash = 'doc-1-2'
    const { chunkDocument, MAX_CALL_CHARS } = await import('./extract')
    const { hasDateSignal } = await import('./prefilter')
    const all = chunkDocument(db.docText['doc-1'], MAX_CALL_CHARS - 400)
    const signal = all.filter((c) => hasDateSignal(c.text)).length
    expect(signal).toBeGreaterThan(12)
    expect(signal).toBeLessThan(24)
    expect(all.length).toBeGreaterThan(signal + 10)

    const before = requests.length
    const step1 = await processNext(SUPABASE, { ai, userId: 'u1', now: NOW, store: memoryStore(db) })
    expect(step1).toMatchObject({ unit: 'document', calls: 12, processed: 0, removed: 0, remaining: 1 })
    expect(step1.note).toMatch(new RegExp(`read parts 1-12 of ${signal} with dates .*the rest follows`))
    expect(db.state.documents[0].ai_hash).toBe('partial:12:doc-1-2')
    const afterStep1 = db.keyDates.filter((k) => k.document_id === 'doc-1').length
    expect(afterStep1).toBeGreaterThan(12)
    // An unfinished pass removes nothing, not even the old version's row.
    expect(db.keyDates.some((k) => k.id === oldDocRow.id)).toBe(true)

    const step2 = await processNext(SUPABASE, { ai, userId: 'u1', now: NOW, store: memoryStore(db) })
    // The old version's 16 Feb row goes, so the item that also states 16 Feb is read again.
    expect(step2).toMatchObject({ unit: 'document', calls: signal - 12, processed: 1, requeued: 1, remaining: 1 })
    expect(step2.note).toMatch(new RegExp(`read parts 13-${signal} of ${signal}.*finished`))
    expect(db.state.documents[0].ai_hash).toBe('doc-1-2')
    expect(requests.length - before).toBe(signal)
    // Every task from every part is there; the first unit's finds survived
    // the last unit; the old version's row is gone.
    const tasks = db.keyDates.filter((k) => k.document_id === 'doc-1').map((k) => k.title.match(/Task (\d+)/)?.[1])
    expect(new Set(tasks).size).toBe(40)
    expect(db.keyDates.some((k) => k.id === oldDocRow.id)).toBe(false)
    const reread = await drain(db, ai)
    expect(reread.map((r) => [r.unit, r.calls])).toEqual([['content', 1]])

    // Unchanged: zero calls.
    const again = await processNext(SUPABASE, { ai, userId: 'u1', now: NOW, store: memoryStore(db) })
    expect(again).toMatchObject({ unit: 'none', calls: 0, remaining: 0 })
  })

  it('restarts a part-read document whose text changed', async () => {
    const db = seed()
    const { ai } = fakeAi()
    await drain(db, ai)
    const page = (n: number) => `Page ${n}. Task ${n} is due ${(n % 28) + 1} March 2027. ` + 'filler words here '.repeat(300)
    db.docText['doc-1'] = Array.from({ length: 40 }, (_, i) => page(i + 1)).join('\f')
    db.state.documents[0].text_hash = 'doc-1-2'
    await processNext(SUPABASE, { ai, userId: 'u1', now: NOW, store: memoryStore(db) })
    expect(db.state.documents[0].ai_hash).toBe('partial:12:doc-1-2')
    db.state.documents[0].text_hash = 'doc-1-3'
    const r = await processNext(SUPABASE, { ai, userId: 'u1', now: NOW, store: memoryStore(db) })
    expect(r.note).toMatch(/read parts 1-12 of/)
    expect(db.state.documents[0].ai_hash).toBe('partial:12:doc-1-3')
  })

  // ------------------------------------- finding 2: a deadline in two sources

  function twoSourceDb(): Db {
    return {
      state: {
        courses: [{ id: C1, module_code: 'GEOG1061', name: 'Border Crises', term: '2026' }],
        content: [],
        contentAi: [],
        announcements: [
          {
            id: 'ann-a',
            course_id: C1,
            title: 'Essay deadline',
            body_text: 'The formative essay is due 24 November 2026 by 2pm.',
            posted_at: '2026-11-01T09:00:00Z',
            body_hash: 'a-1',
            ai_hash: null,
          },
        ],
        documents: [],
      },
      docText: {},
      assignments: [],
      keyDates: [],
      writes: 0,
    }
  }

  const sourceB = () =>
    content('ct-b', 'Essay reminder', { body_text: 'The formative essay is due 24 November 2026 by 2pm.', body_hash: 'b-1' })

  it('keeps a deadline stated by two sources when the first one stops stating it', async () => {
    const db = twoSourceDb()
    const { ai, requests } = fakeAi()

    // A first: its row.
    await drain(db, ai)
    expect(requests).toHaveLength(1)
    expect(db.keyDates.map((k) => [k.announcement_id, k.due_on])).toEqual([['ann-a', '2026-11-24']])

    // B states the same deadline: merged into A's row, nothing inserted.
    db.state.content.push(sourceB())
    await drain(db, ai)
    expect(requests.map((r) => r.feature)).toEqual(['bb_extract_announcement', 'bb_classify', 'bb_extract_content'])
    expect(db.keyDates).toHaveLength(1)

    // A is edited and no longer states it: A's row goes, B is read again.
    const a = db.state.announcements[0]
    Object.assign(a, { body_text: 'The essay deadline is on the module page.', body_hash: 'a-2' })
    const before = requests.length
    const results = await drain(db, ai)
    expect(requests.slice(before).map((r) => r.feature)).toEqual(['bb_extract_announcement', 'bb_extract_content'])
    expect(results[0]).toMatchObject({ unit: 'announcements', removed: 1, requeued: 1 })
    expect(results[results.length - 1].remaining).toBe(0)
    expect(db.keyDates.map((k) => [k.content_id, k.due_on, k.status])).toEqual([['ct-b', '2026-11-24', 'suggested']])

    // Nothing loops: an unchanged pass makes no calls.
    const last = requests.length
    await drain(db, ai)
    expect(requests.length).toBe(last)
  })

  it('also re-reads the other source when the first one loses its date signal entirely', async () => {
    const db = twoSourceDb()
    const { ai, requests } = fakeAi()
    await drain(db, ai)
    db.state.content.push(sourceB())
    await drain(db, ai)
    Object.assign(db.state.announcements[0], { title: 'Update', body_text: 'Tutorials are cancelled.', body_hash: 'a-2' })
    const before = requests.length
    await drain(db, ai)
    expect(requests.slice(before).map((r) => r.feature)).toEqual(['bb_extract_content'])
    expect(db.keyDates.map((k) => k.content_id)).toEqual(['ct-b'])
  })

  it("doesn't lose the deadline when both sources change in one batch, whatever their order", async () => {
    const db = twoSourceDb()
    const { ai, requests } = fakeAi()
    await drain(db, ai)
    // X (listed first) now states the deadline; A (same batch) stops.
    db.state.announcements.unshift({
      id: 'ann-x',
      course_id: C1,
      title: 'Reminder',
      body_text: 'The formative essay is due 24 November 2026 by 2pm.',
      posted_at: '2026-11-05T09:00:00Z',
      body_hash: 'x-1',
      ai_hash: null,
    })
    Object.assign(db.state.announcements[1], { body_text: 'The essay deadline is on the module page.', body_hash: 'a-2' })
    const before = requests.length
    await drain(db, ai)
    expect(requests.length - before).toBe(1)
    expect(db.keyDates.map((k) => [k.announcement_id, k.due_on])).toEqual([['ann-x', '2026-11-24']])
  })

  // ---------------------------------------- finding 6: a batch that keeps failing

  it('splits a batch with an unusable reply, parks the item that keeps failing, and never re-spends on it', async () => {
    const db = seed()
    db.state.content.find((c) => c.id === 'essay')!.body_text = 'POISON'
    const { ai: healthy, requests } = fakeAi()
    // The reply for any prompt holding the poisoned item is cut off mid-JSON.
    const truncating: AiCall = async (req) => {
      if (req.feature.startsWith('bb_extract') && req.prompt.includes('POISON')) {
        requests.push(req)
        throw new SyntaxError('Unexpected end of JSON input')
      }
      return healthy(req)
    }

    const first = await drain(db, truncating, 40)
    expect(first.every((r) => !r.error)).toBe(true)
    const units = first.map((r) => r.unit)
    expect(units).toEqual(['classify', 'classify', 'announcements', 'content', 'content', 'content', 'content', 'content', 'content', 'document'])
    // The 5-item content batch: 2 attempts, then each item alone; the poisoned
    // one gets 2 attempts and is parked.
    const content = requests.filter((r) => r.feature === 'bb_extract_content')
    expect(content.map((r) => blocks(r.prompt).length)).toEqual([5, 5, 1, 1, 1, 1, 1, 1])
    expect(first[3]).toMatchObject({ unit: 'content', calls: 2, processed: 0, failed: 0 })
    expect(first[3].note).toMatch(/5 got an unusable reply/)
    expect(first[5]).toMatchObject({ unit: 'content', calls: 2, failed: 1 })
    expect(first[first.length - 1]).toMatchObject({ unit: 'document', failed: 1, remaining: 0 })
    const essayAi = db.state.contentAi.find((a) => a.content_id === 'essay')!
    expect(essayAi.extracted_hash).toBe('fail:hash-essay-1')
    // The others were extracted.
    expect(db.keyDates.map((k) => k.due_on).sort()).toEqual(['2026-11-13', '2026-11-17', '2027-02-16', '2027-02-16'])

    // An unchanged second pass: zero calls, the failure still reported.
    const calls = requests.length
    const second = await processNext(SUPABASE, { ai: truncating, userId: 'u1', now: NOW, store: memoryStore(db) })
    expect(second).toMatchObject({ unit: 'none', calls: 0, remaining: 0, failed: 1 })
    expect(requests.length).toBe(calls)

    // A manual retry sends it alone once more.
    const retried = await processNext(SUPABASE, { ai: healthy, userId: 'u1', now: NOW, store: memoryStore(db), retryFailed: true })
    expect(retried).toMatchObject({ unit: 'content', calls: 1, failed: 0, added: 1, remaining: 0 })
    expect(blocks(requests[requests.length - 1].prompt)).toHaveLength(1)
    expect(essayAi.extracted_hash).toBe(db.state.content.find((c) => c.id === 'essay')!.body_hash)
  })

  it('plans a parked row again as soon as its text changes', async () => {
    const db = seed()
    const { ai, requests } = fakeAi()
    await drain(db, ai)
    const essay = db.state.content.find((c) => c.id === 'essay')!
    db.state.contentAi.find((a) => a.content_id === 'essay')!.extracted_hash = `fail:${essay.body_hash}`
    expect((await processNext(SUPABASE, { ai, userId: 'u1', now: NOW, store: memoryStore(db) })).calls).toBe(0)
    essay.body_hash = 'hash-essay-2'
    const before = requests.length
    await drain(db, ai)
    expect(requests.slice(before).map((r) => r.feature)).toEqual(['bb_classify', 'bb_extract_content'])
  })

  it('marks nothing when the failure is not about the batch (network, rate limit)', async () => {
    const db = seed()
    const { ai } = fakeAi()
    await drain(db, ai)
    db.state.content.find((c) => c.id === 'essay')!.body_hash = 'hash-essay-2'
    db.state.contentAi.find((a) => a.content_id === 'essay')!.classified_hash = 'hash-essay-2'
    const rateLimited: AiCall = async () => {
      const err = new Error('429 Too Many Requests') as Error & { status: number }
      err.status = 429
      throw err
    }
    const r = await processNext(SUPABASE, { ai: rateLimited, userId: 'u1', now: NOW, store: memoryStore(db) })
    expect(r).toMatchObject({ unit: 'content', error: '429 Too Many Requests', calls: 3, remaining: 1, failed: 0 })
    expect(db.state.contentAi.find((a) => a.content_id === 'essay')!.extracted_hash).toBe('hash-essay-1')
  })

  it('parks a document whose reply is unusable', async () => {
    const db = seed()
    const { ai } = fakeAi()
    await drain(db, ai)
    db.state.documents[0].text_hash = 'doc-1-2'
    const empty: AiCall = async () => {
      throw new Error('Gemini returned an empty response')
    }
    const r = await processNext(SUPABASE, { ai: empty, userId: 'u1', now: NOW, store: memoryStore(db) })
    expect(r).toMatchObject({ unit: 'document', calls: 2, failed: 1, remaining: 0 })
    expect(db.state.documents[0].ai_hash).toBe('fail:doc-1-2')
  })
})
