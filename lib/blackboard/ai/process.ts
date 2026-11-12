import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { londonToday } from '@/lib/blackboard/dates'
import { planClassifyBatches, type Classification, type ClassifyRow } from './classify'
import {
  ANNOUNCEMENT_LIMITS,
  chunkDocument,
  CONTENT_LIMITS,
  DOCUMENT_CONCURRENCY,
  MAX_CALL_CHARS,
  MAX_DOCUMENT_CHUNKS,
  planExtractBatches,
  prepareSource,
  type ExtractContext,
  type ExtractSource,
} from './extract'
import {
  academicWindow,
  mergeKeyDates,
  type AssignmentLite,
  type ExistingKeyDate,
  type FoundKeyDate,
  type KeyDateMerge,
  type KeyDateSourceKind,
} from './grounding'
import { runClassifyBatch, runExtractBatch, type AiCall, type ExtractBatchResult } from './pipeline'
import { hasDateSignal } from './prefilter'

// Runs ONE unit of Blackboard AI work per call (POST /api/work/process,
// looped by useBbProcessing while the dashboard is open).
//
// The cost rule: never reprocess unchanged data. bb_content.body_hash,
// bb_announcements.body_hash and bb_documents.text_hash are generated md5
// columns; a row needs work only while the hash its AI row / ai_hash
// recorded differs. Batches are built only from rows that need work, a text
// with no date signal is marked done with zero AI calls, and hashes only
// advance once the unit's writes succeeded. A second pass over unchanged
// data makes zero AI calls.
//
// Unit order: classify batch → announcement batch → content batch → one
// document. Only module courses (module_code set, not removed) and live rows
// are processed. Writes go through the caller's session client (RLS) and
// touch dashboard-owned columns only: bb_content_ai, bb_key_dates,
// bb_announcements.ai_hash, bb_documents.ai_hash.

// ------------------------------------------------------------------ types --

export type ProcessUnit = 'classify' | 'announcements' | 'content' | 'document' | 'none'

export interface ProcessResult {
  unit: ProcessUnit
  /** Rows whose hash advanced this call (including no-signal ones). */
  processed: number
  /** Rows (per job) that needed no work because they're unchanged. */
  skippedUnchanged: number
  /** Texts with no date signal, marked done without an AI call. */
  skippedNoSignal: number
  added: number
  updated: number
  removed: number
  /** AI items dropped because their quote isn't in the source. */
  ungrounded: number
  /** AI items dropped as malformed or outside the academic year. */
  invalid: number
  /** Model calls made. */
  calls: number
  /** Units still pending after this one. */
  remaining: number
  budgetHit: boolean
  error?: string
  /** E.g. a document cut at the chunk limit. */
  note?: string
}

export interface CourseLite {
  id: string
  module_code: string | null
  name: string | null
  term: string | null
}

export interface ContentLite extends ClassifyRow {
  available_from: string | null
}

export interface ContentAiLite {
  content_id: string
  classified_hash: string | null
  extracted_hash: string | null
}

export interface AnnouncementLite {
  id: string
  course_id: string
  title: string
  body_text: string | null
  posted_at: string | null
  body_hash: string
  ai_hash: string | null
}

export interface DocumentLite {
  id: string
  content_id: string
  file_name: string
  text_hash: string
  ai_hash: string | null
}

export interface WorkState {
  /** Live module courses only. */
  courses: CourseLite[]
  /** Live content of those courses. */
  content: ContentLite[]
  contentAi: ContentAiLite[]
  /** Live announcements of those courses. */
  announcements: AnnouncementLite[]
  /** Live documents (no text). */
  documents: DocumentLite[]
}

export interface ClassificationWrite extends Classification {
  classified_hash: string
  model: string
}

export interface KeyDateWriteCounts {
  added: number
  updated: number
  removed: number
}

/** The reads and writes processNext needs. Every method throws on failure. */
export interface WorkStore {
  loadState(): Promise<WorkState>
  loadDocumentText(id: string): Promise<string | null>
  loadAssignments(courseId: string): Promise<AssignmentLite[]>
  loadKeyDates(courseId: string): Promise<ExistingKeyDate[]>
  saveClassifications(rows: ClassificationWrite[]): Promise<void>
  markContentExtracted(rows: { content_id: string; extracted_hash: string }[]): Promise<void>
  markAnnouncements(rows: { id: string; ai_hash: string }[]): Promise<void>
  markDocument(id: string, aiHash: string): Promise<void>
  applyKeyDates(merge: KeyDateMerge, model: string | null): Promise<KeyDateWriteCounts>
  /** Deletes the still-suggested key dates of these sources; returns how many. */
  removeSuggestedFrom(kind: KeyDateSourceKind, ids: string[]): Promise<number>
}

export interface ProcessDeps {
  /** The model call (generateStructured in the app, a fake in tests). */
  ai: AiCall
  /** The signed-in user (auth.uid()); written as user_id so RLS checks pass. */
  userId: string
  now?: () => Date
  /** Calls left in today's Blackboard budget; a document needing more is not started. */
  budgetRemaining?: () => Promise<number>
  /** Defaults to supabaseWorkStore(supabase, userId). */
  store?: WorkStore
  /** Attempts per batch within one call before reporting the error (default 3). */
  maxAttempts?: number
  /** No new attempt starts after this many ms (default 35 s, under the route's 60 s). */
  retryWindowMs?: number
}


// -------------------------------------------------------------- planning --

interface Plan {
  classify: ContentLite[][]
  announcements: ExtractSource[][]
  content: ExtractSource[][]
  documents: DocumentLite[]
}

function unitCount(plan: Plan): number {
  return plan.classify.length + plan.announcements.length + plan.content.length + plan.documents.length
}

function announcementSource(a: AnnouncementLite): ExtractSource {
  return { kind: 'announcement', id: a.id, course_id: a.course_id, title: a.title, text: a.body_text ?? '', posted: a.posted_at }
}

function contentSource(c: ContentLite): ExtractSource {
  return {
    kind: 'content',
    id: c.id,
    course_id: c.course_id,
    title: c.title,
    text: c.body_text ?? '',
    posted: c.available_from,
    path: c.path,
  }
}

function emptyResult(unit: ProcessUnit): ProcessResult {
  return {
    unit,
    processed: 0,
    skippedUnchanged: 0,
    skippedNoSignal: 0,
    added: 0,
    updated: 0,
    removed: 0,
    ungrounded: 0,
    invalid: 0,
    calls: 0,
    remaining: 0,
    budgetHit: false,
  }
}

function isBudgetError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AiBudgetExceededError'
}

function isDisabledError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AiDisabledError'
}

function message(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 300)
}

/** Runs `tasks` at most `limit` at a time; rejects with the first failure. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length)
  let next = 0
  async function worker() {
    while (next < tasks.length) {
      const i = next++
      out[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return out
}

// ------------------------------------------------------------ processNext --

export async function processNext(supabase: SupabaseClient, deps: ProcessDeps): Promise<ProcessResult> {
  const store = deps.store ?? supabaseWorkStore(supabase, deps.userId)
  const now = deps.now ?? (() => new Date())
  const maxAttempts = Math.max(1, deps.maxAttempts ?? 3)
  const retryWindowMs = deps.retryWindowMs ?? 35_000
  const started = now().getTime()
  const today = londonToday(now())

  let calls = 0
  const ai: AiCall = (request) => {
    calls++
    return deps.ai(request)
  }
  // Retries a failing batch within this call; budget / disabled errors never retry.
  async function attempt<T>(run: () => Promise<T>): Promise<T> {
    let last: unknown
    for (let i = 0; i < maxAttempts; i++) {
      if (i > 0 && now().getTime() - started > retryWindowMs) break
      try {
        return await run()
      } catch (err) {
        if (isBudgetError(err) || isDisabledError(err)) throw err
        last = err
      }
    }
    throw last
  }

  let state: WorkState
  try {
    state = await store.loadState()
  } catch (err) {
    return { ...emptyResult('none'), error: `Couldn't read Blackboard data: ${message(err)}` }
  }

  const courseById = new Map(state.courses.filter((c) => c.module_code).map((c) => [c.id, c]))
  const content = state.content.filter((c) => courseById.has(c.course_id))
  const contentById = new Map(content.map((c) => [c.id, c]))
  const aiByContent = new Map(state.contentAi.map((r) => [r.content_id, r]))
  const announcements = state.announcements.filter((a) => courseById.has(a.course_id))
  const documents = state.documents.filter((d) => contentById.has(d.content_id))

  const classifyPending = content.filter((c) => aiByContent.get(c.id)?.classified_hash !== c.body_hash)
  let extractPending = content.filter((c) => (aiByContent.get(c.id)?.extracted_hash ?? null) !== c.body_hash)
  let announcementPending = announcements.filter((a) => a.ai_hash !== a.body_hash)
  const documentPending = documents.filter((d) => d.ai_hash !== d.text_hash)

  const result = emptyResult('none')
  result.skippedUnchanged =
    content.length -
    classifyPending.length +
    (content.length - extractPending.length) +
    (announcements.length - announcementPending.length) +
    (documents.length - documentPending.length)

  // Free bookkeeping first: texts with no date signal are done without a call.
  const quietAnnouncements = announcementPending.filter((a) => !hasDateSignal(`${a.title}\n${a.body_text ?? ''}`))
  const quietContent = extractPending.filter((c) => !hasDateSignal(`${c.title}\n${c.body_text ?? ''}`))
  if (quietAnnouncements.length || quietContent.length) {
    try {
      if (quietAnnouncements.length) {
        result.removed += await store.removeSuggestedFrom('announcement', quietAnnouncements.map((a) => a.id))
        await store.markAnnouncements(quietAnnouncements.map((a) => ({ id: a.id, ai_hash: a.body_hash })))
      }
      if (quietContent.length) {
        result.removed += await store.removeSuggestedFrom('content', quietContent.map((c) => c.id))
        await store.markContentExtracted(quietContent.map((c) => ({ content_id: c.id, extracted_hash: c.body_hash })))
      }
    } catch (err) {
      // Nothing was planned yet: report at least one unit left so the caller doesn't read "done".
      return { ...result, remaining: 1, error: `Couldn't save progress: ${message(err)}` }
    }
    result.skippedNoSignal = quietAnnouncements.length + quietContent.length
    result.processed = result.skippedNoSignal
    const quietA = new Set(quietAnnouncements.map((a) => a.id))
    const quietC = new Set(quietContent.map((c) => c.id))
    announcementPending = announcementPending.filter((a) => !quietA.has(a.id))
    extractPending = extractPending.filter((c) => !quietC.has(c.id))
  }

  const plan: Plan = {
    classify: planClassifyBatches(classifyPending),
    announcements: planExtractBatches(announcementPending.map(announcementSource), ANNOUNCEMENT_LIMITS),
    content: planExtractBatches(extractPending.map(contentSource), CONTENT_LIMITS),
    documents: documentPending,
  }
  const total = unitCount(plan)
  if (total === 0) return result

  const contextFor = (courseId: string) => {
    const course = courseById.get(courseId)
    return {
      moduleCode: course?.module_code ?? null,
      courseName: course?.name ?? null,
      window: academicWindow(course?.term, today),
    }
  }

  const finish = (unit: ProcessUnit, extra: Partial<ProcessResult>): ProcessResult => ({
    ...result,
    ...extra,
    processed: result.processed + (extra.processed ?? 0),
    removed: result.removed + (extra.removed ?? 0),
    unit,
    calls,
    remaining: extra.error || extra.budgetHit ? total : total - 1,
  })

  const fail = (unit: ProcessUnit, err: unknown): ProcessResult => {
    if (isBudgetError(err)) return finish(unit, { budgetHit: true })
    return finish(unit, { error: message(err) })
  }

  // ---- classify
  if (plan.classify.length) {
    const batch = plan.classify[0]
    try {
      const ctx = contextFor(batch[0].course_id)
      const { rows, model } = await attempt(() => runClassifyBatch(batch, ctx, ai))
      const hashById = new Map(batch.map((r) => [r.id, r.body_hash]))
      await store.saveClassifications(
        rows.map((r) => ({ ...r, classified_hash: hashById.get(r.content_id) as string, model }))
      )
      return finish('classify', { processed: batch.length })
    } catch (err) {
      return fail('classify', err)
    }
  }

  // ---- announcements / content batches
  const extractUnit = plan.announcements.length ? 'announcements' : plan.content.length ? 'content' : null
  if (extractUnit) {
    const batch = (extractUnit === 'announcements' ? plan.announcements : plan.content)[0]
    try {
      const courseId = batch[0].course_id
      const { counts, extracted } = await extractAndMerge(store, batch, courseId, contextFor(courseId), today, ai, attempt)
      if (extractUnit === 'announcements') {
        const hashById = new Map(announcementPending.map((a) => [a.id, a.body_hash]))
        await store.markAnnouncements(batch.map((s) => ({ id: s.id, ai_hash: hashById.get(s.id) as string })))
      } else {
        const hashById = new Map(extractPending.map((c) => [c.id, c.body_hash]))
        await store.markContentExtracted(batch.map((s) => ({ content_id: s.id, extracted_hash: hashById.get(s.id) as string })))
      }
      return finish(extractUnit, {
        processed: batch.length,
        added: counts.added,
        updated: counts.updated,
        removed: counts.removed,
        ungrounded: extracted.ungrounded,
        invalid: extracted.invalid,
        note: batch.some((s) => s.truncated) ? 'A long text was cut to fit one call.' : undefined,
      })
    } catch (err) {
      return fail(extractUnit, err)
    }
  }

  // ---- one document
  const doc = plan.documents[0]
  try {
    const owner = contentById.get(doc.content_id) as ContentLite
    const courseId = owner.course_id
    const text = (await store.loadDocumentText(doc.id)) ?? ''
    const allChunks = chunkDocument(text, MAX_CALL_CHARS - 400)
    const chunks = allChunks.slice(0, MAX_DOCUMENT_CHUNKS)
    const note =
      allChunks.length > MAX_DOCUMENT_CHUNKS
        ? `${doc.file_name}: read the first ${MAX_DOCUMENT_CHUNKS} of ${allChunks.length} parts (pages 1-${chunks[chunks.length - 1].lastPage}).`
        : undefined
    const sources = chunks
      .filter((c) => hasDateSignal(c.text))
      .map((c) =>
        prepareSource({
          kind: 'document',
          id: doc.id,
          course_id: courseId,
          title: doc.file_name,
          text: c.text,
          posted: null,
          pages: { first: c.firstPage, last: c.lastPage },
        })
      )

    if (sources.length === 0) {
      const removed = await store.removeSuggestedFrom('document', [doc.id])
      await store.markDocument(doc.id, doc.text_hash)
      return finish('document', { processed: 1, skippedNoSignal: result.skippedNoSignal + 1, removed, note })
    }
    if (deps.budgetRemaining) {
      const left = await deps.budgetRemaining()
      if (left < sources.length) return finish('document', { budgetHit: true, note })
    }

    const { counts, extracted } = await extractAndMerge(
      store,
      sources.map((s) => [s]),
      courseId,
      contextFor(courseId),
      today,
      ai,
      attempt
    )
    await store.markDocument(doc.id, doc.text_hash)
    return finish('document', {
      processed: 1,
      added: counts.added,
      updated: counts.updated,
      removed: counts.removed,
      ungrounded: extracted.ungrounded,
      invalid: extracted.invalid,
      note,
    })
  } catch (err) {
    return fail('document', err)
  }
}

/**
 * Model calls for one course's sources, then one merge per source against
 * the course's key dates, then the writes. `batches` is either one batch of
 * several sources (announcements / content) or one single-source batch per
 * document chunk (run DOCUMENT_CONCURRENCY at a time, merged as one source).
 * Nothing is written unless every call succeeded.
 */
async function extractAndMerge(
  store: WorkStore,
  batches: ExtractSource[] | ExtractSource[][],
  courseId: string,
  course: { moduleCode: string | null; courseName: string | null; window: { from: string; to: string } },
  today: string,
  ai: AiCall,
  attempt: <T>(run: () => Promise<T>) => Promise<T>
): Promise<{ counts: KeyDateWriteCounts; extracted: { ungrounded: number; invalid: number } }> {
  const assignments = (await store.loadAssignments(courseId)).sort((a, b) =>
    (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999')
  )
  const ctx: ExtractContext = {
    today,
    window: course.window,
    moduleCode: course.moduleCode,
    courseName: course.courseName,
    assignments: assignments.map((a) => ({ title: a.title, due_at: a.due_at })),
  }

  const groups: ExtractSource[][] = Array.isArray(batches[0]) ? (batches as ExtractSource[][]) : [batches as ExtractSource[]]
  const results: ExtractBatchResult[] = await pool(
    groups.map((group) => () => attempt(() => runExtractBatch(group, ctx, assignments, ai))),
    DOCUMENT_CONCURRENCY
  )

  // Found key dates per source id (document chunks all share their document's id).
  const bySource = new Map<string, { kind: KeyDateSourceKind; found: FoundKeyDate[] }>()
  groups.forEach((group, g) =>
    group.forEach((s, i) => {
      const entry = bySource.get(s.id) ?? { kind: s.kind, found: [] }
      entry.found.push(...results[g].perSource[i])
      bySource.set(s.id, entry)
    })
  )

  let working = await store.loadKeyDates(courseId)
  const combined: KeyDateMerge = { insert: [], update: [], remove: [] }
  let pendingId = 0
  for (const [id, { kind, found }] of bySource) {
    const merge = mergeKeyDates(working, found, { kind, id })
    combined.insert.push(...merge.insert)
    combined.update.push(...merge.update)
    combined.remove.push(...merge.remove)
    // Later sources in this batch see this source's outcome, so a deadline in
    // two announcements of one batch is inserted once.
    const removed = new Set(merge.remove)
    const patches = new Map(merge.update.map((u) => [u.id, u.patch]))
    working = working
      .filter((r) => !removed.has(r.id))
      .map((r) => (patches.has(r.id) ? { ...r, ...patches.get(r.id) } : r))
      .concat(merge.insert.map((r) => ({ ...r, id: `pending:${pendingId++}`, assignment_id: r.assignment_id })))
  }

  const model = results.find((r) => r.model)?.model ?? null
  const counts = await store.applyKeyDates(combined, model)
  return {
    counts,
    extracted: {
      ungrounded: results.reduce((n, r) => n + r.ungrounded, 0),
      invalid: results.reduce((n, r) => n + r.invalid, 0),
    },
  }
}

// --------------------------------------------------------- supabase store --

const PAGE = 1000

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

async function readAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

const SOURCE_COLUMN: Record<KeyDateSourceKind, string> = {
  announcement: 'announcement_id',
  content: 'content_id',
  document: 'document_id',
}

const KEY_DATE_COLUMNS =
  'id, course_id, announcement_id, content_id, document_id, title, category, due_on, ai_due_on, due_at, for_session_type, for_week, quote, status, assignment_id, fingerprint'

/** WorkStore over the caller's session client (RLS applies; user_id is auth.uid()). */
export function supabaseWorkStore(supabase: SupabaseClient, userId: string): WorkStore {
  const stamp = () => new Date().toISOString()
  return {
    async loadState() {
      const { data: courses, error } = await supabase
        .from('bb_courses')
        .select('id, module_code, name, term')
        .not('module_code', 'is', null)
        .is('removed_at', null)
      check(error)
      const ids = (courses ?? []).map((c) => c.id as string)
      if (ids.length === 0) return { courses: [], content: [], contentAi: [], announcements: [], documents: [] }

      const [content, contentAi, announcements, documents] = await Promise.all([
        readAll<ContentLite>((from, to) =>
          supabase
            .from('bb_content')
            .select('id, course_id, kind, title, path, body_text, links, body_hash, available_from')
            .in('course_id', ids)
            .is('removed_at', null)
            .order('id')
            .range(from, to)
        ),
        readAll<ContentAiLite>((from, to) =>
          supabase.from('bb_content_ai').select('content_id, classified_hash, extracted_hash').order('content_id').range(from, to)
        ),
        readAll<AnnouncementLite>((from, to) =>
          supabase
            .from('bb_announcements')
            .select('id, course_id, title, body_text, posted_at, body_hash, ai_hash')
            .in('course_id', ids)
            .is('removed_at', null)
            .order('id')
            .range(from, to)
        ),
        readAll<DocumentLite>((from, to) =>
          supabase
            .from('bb_documents')
            .select('id, content_id, file_name, text_hash, ai_hash')
            .is('removed_at', null)
            .order('id')
            .range(from, to)
        ),
      ])
      return {
        courses: (courses ?? []) as CourseLite[],
        content: content.map((c) => ({ ...c, path: Array.isArray(c.path) ? c.path : [], links: Array.isArray(c.links) ? c.links : [] })),
        contentAi,
        announcements,
        documents,
      }
    },

    async loadDocumentText(id) {
      const { data, error } = await supabase.from('bb_documents').select('text').eq('id', id).maybeSingle()
      check(error)
      return (data?.text as string | undefined) ?? null
    },

    async loadAssignments(courseId) {
      const { data, error } = await supabase
        .from('bb_assignments')
        .select('id, course_id, title, due_at')
        .eq('course_id', courseId)
        .is('removed_at', null)
      check(error)
      return (data ?? []) as AssignmentLite[]
    },

    async loadKeyDates(courseId) {
      const { data, error } = await supabase.from('bb_key_dates').select(KEY_DATE_COLUMNS).eq('course_id', courseId)
      check(error)
      return (data ?? []) as ExistingKeyDate[]
    },

    async saveClassifications(rows) {
      if (!rows.length) return
      const updated_at = stamp()
      const { error } = await supabase.from('bb_content_ai').upsert(
        rows.map((r) => ({
          user_id: userId,
          content_id: r.content_id,
          role: r.role,
          uni_week: r.uni_week,
          session_type: r.session_type,
          lecture_ordinal: r.lecture_ordinal,
          explicit_date: r.explicit_date,
          classified_hash: r.classified_hash,
          model: r.model,
          updated_at,
        })),
        { onConflict: 'user_id,content_id' }
      )
      check(error)
    },

    async markContentExtracted(rows) {
      if (!rows.length) return
      const updated_at = stamp()
      // Only these columns: a new row gets role 'other' by default and is still
      // pending classification (classified_hash null).
      const { error } = await supabase.from('bb_content_ai').upsert(
        rows.map((r) => ({ user_id: userId, content_id: r.content_id, extracted_hash: r.extracted_hash, updated_at })),
        { onConflict: 'user_id,content_id' }
      )
      check(error)
    },

    async markAnnouncements(rows) {
      await pool(
        rows.map((r) => async () => {
          const { error } = await supabase.from('bb_announcements').update({ ai_hash: r.ai_hash }).eq('id', r.id)
          check(error)
        }),
        8
      )
    },

    async markDocument(id, aiHash) {
      const { error } = await supabase.from('bb_documents').update({ ai_hash: aiHash }).eq('id', id)
      check(error)
    },

    async applyKeyDates(merge, model) {
      const updated_at = stamp()
      let removed = 0
      let updated = 0
      let added = 0
      // Removals first: they free fingerprints. Every write is guarded by
      // status = 'suggested', so a row I confirm or dismiss meanwhile is safe.
      if (merge.remove.length) {
        const { data, error } = await supabase
          .from('bb_key_dates')
          .delete()
          .in('id', merge.remove)
          .eq('status', 'suggested')
          .select('id')
        check(error)
        removed = data?.length ?? 0
      }
      for (const u of merge.update) {
        const { data, error } = await supabase
          .from('bb_key_dates')
          .update({ ...u.patch, model, updated_at })
          .eq('id', u.id)
          .eq('status', 'suggested')
          .select('id')
        check(error)
        updated += data?.length ?? 0
      }
      if (merge.insert.length) {
        // ON CONFLICT DO NOTHING on (user_id, fingerprint): an existing row,
        // dismissed or not, is never overwritten.
        const { data, error } = await supabase
          .from('bb_key_dates')
          .upsert(
            merge.insert.map((r) => ({
              user_id: userId,
              course_id: r.course_id,
              announcement_id: r.announcement_id,
              content_id: r.content_id,
              document_id: r.document_id,
              title: r.title,
              category: r.category,
              due_on: r.due_on,
              due_at: r.due_at,
              ai_due_on: r.ai_due_on,
              for_session_type: r.for_session_type,
              for_week: r.for_week,
              quote: r.quote,
              status: 'suggested',
              assignment_id: r.assignment_id,
              fingerprint: r.fingerprint,
              model,
              updated_at,
            })),
            { onConflict: 'user_id,fingerprint', ignoreDuplicates: true }
          )
          .select('id')
        check(error)
        added = data?.length ?? 0
      }
      return { added, updated, removed }
    },

    async removeSuggestedFrom(kind, ids) {
      let removed = 0
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await supabase
          .from('bb_key_dates')
          .delete()
          .in(SOURCE_COLUMN[kind], ids.slice(i, i + 200))
          .eq('status', 'suggested')
          .select('id')
        check(error)
        removed += data?.length ?? 0
      }
      return removed
    },
  }
}
