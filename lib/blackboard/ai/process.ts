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
  normaliseQuote,
  type AssignmentLite,
  type ExistingKeyDate,
  type FoundKeyDate,
  type KeyDateMerge,
  type KeyDateSourceKind,
  type MergeOptions,
} from './grounding'
import { failMarker, hashState, partialMarker, retryMarker, type HashState } from './markers'
import { runClassifyBatch, runExtractBatch, type AiCall, type ExtractBatchResult } from './pipeline'
import { hasDateSignal } from './prefilter'
import { mentionsDate, mentionsRelatively } from './quote-dates'

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
// Those hash columns also carry markers (./markers.ts): a batch whose reply
// is unusable (truncated / unparseable / wrong shape) marks its rows
// `retry:<hash>` and they are then sent one at a time; a row that fails on
// its own is marked `fail:<hash>` and left alone until a manual retry
// (`retryFailed`). A long document advances `partial:<chunk>:<hash>` one
// unit at a time. Errors that aren't about the batch (network, rate limit,
// budget, server) mark nothing and stop the loop, as before.
//
// A deadline found in two sources is stored once, under the first. When a
// suggested row is removed (or moved to another day), the other sources of
// the course that mention that day are re-queued (their hash cleared) so
// the next unit reads them again. A re-queued source (hash null) never
// re-queues others in turn, so this can't loop.
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
  /** AI items dropped because their quote isn't in their own source or states no date. */
  ungrounded: number
  /** AI items dropped because their quote states a different date. */
  dateMismatch: number
  /** AI items dropped: only a relative date, in a source with no posted day. */
  noAnchor: number
  /** AI items dropped as malformed or outside the academic year. */
  invalid: number
  /** Other sources queued to be read again because a deadline they mention lost its row. */
  requeued: number
  /** Rows (per job) currently marked `fail:` for their current text; never retried automatically. */
  failed: number
  /** Model calls made. */
  calls: number
  /** Units still pending after this one. */
  remaining: number
  budgetHit: boolean
  error?: string
  /** E.g. a document read in parts, a batch split after an unusable reply. */
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

/** A suggested key date that is about to disappear from a day. */
export interface LostKeyDate {
  id: string
  course_id: string
  due_on: string
  announcement_id: string | null
  content_id: string | null
  document_id: string | null
}

/** The reads and writes processNext needs. Every method throws on failure. */
export interface WorkStore {
  loadState(): Promise<WorkState>
  loadDocumentText(id: string): Promise<string | null>
  loadAssignments(courseId: string): Promise<AssignmentLite[]>
  loadKeyDates(courseId: string): Promise<ExistingKeyDate[]>
  saveClassifications(rows: ClassificationWrite[]): Promise<void>
  /** Writes only classified_hash (a retry / fail marker); never the classification itself. */
  markClassified(rows: { content_id: string; classified_hash: string }[]): Promise<void>
  /** A hash, a marker, or null (re-queued). */
  markContentExtracted(rows: { content_id: string; extracted_hash: string | null }[]): Promise<void>
  markAnnouncements(rows: { id: string; ai_hash: string | null }[]): Promise<void>
  markDocument(id: string, aiHash: string | null): Promise<void>
  applyKeyDates(merge: KeyDateMerge, model: string | null): Promise<KeyDateWriteCounts>
  /** The still-suggested key dates of these sources. */
  loadSuggestedFrom(kind: KeyDateSourceKind, ids: string[]): Promise<LostKeyDate[]>
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
  /** First turn every `fail:` marker back into `retry:` (the manual "retry failed" action). */
  retryFailed?: boolean
}

/** Attempts for a batch whose reply was unusable: one more try, then split / mark. */
export const OUTPUT_ERROR_ATTEMPTS = 2

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
    dateMismatch: 0,
    noAnchor: 0,
    invalid: 0,
    requeued: 0,
    failed: 0,
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

/**
 * The model answered, but the reply can't be used: JSON cut off at the
 * token cap or otherwise unparseable (SyntaxError from JSON.parse in
 * lib/ai/gemini.ts), an empty reply (e.g. blocked), or the wrong shape
 * (AiOutputError). That is about THIS batch, so it is marked and the queue
 * moves on. Anything else (network, rate limit, server, budget) would fail
 * every batch alike, so nothing is marked and the loop stops.
 */
export function isBatchError(err: unknown): boolean {
  if (err instanceof SyntaxError) return true
  if (!(err instanceof Error)) return false
  return err.name === 'AiOutputError' || /empty response/i.test(err.message)
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

const sourceIdOf = (r: Pick<LostKeyDate, 'announcement_id' | 'content_id' | 'document_id'>) =>
  r.announcement_id ?? r.content_id ?? r.document_id ?? ''

/** Lower-cased, whitespace-normalised text that quotes are looked up in. */
function quoteHaystack(title: string, text: string): string {
  return normaliseQuote(`${title}\n${text}`)
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
  // Retries a failing batch within this call; budget / disabled errors never
  // retry, and an unusable reply gets one more try only (it costs tokens).
  async function attempt<T>(run: () => Promise<T>): Promise<T> {
    let last: unknown
    for (let i = 0; i < maxAttempts; i++) {
      if (i > 0 && now().getTime() - started > retryWindowMs) break
      if (i >= OUTPUT_ERROR_ATTEMPTS && isBatchError(last)) break
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

  const result = emptyResult('none')

  // ---- the manual "retry failed rows" action: fail:<hash> → retry:<hash>.
  if (deps.retryFailed) {
    try {
      await clearFailMarkers(store, content, aiByContent, announcements, documents)
    } catch (err) {
      return { ...result, remaining: 1, error: `Couldn't reset failed rows: ${message(err)}` }
    }
  }

  const classifyState = (c: ContentLite) => hashState(aiByContent.get(c.id)?.classified_hash, c.body_hash)
  const extractState = (c: ContentLite) => hashState(aiByContent.get(c.id)?.extracted_hash, c.body_hash)
  const announcementState = (a: AnnouncementLite) => hashState(a.ai_hash, a.body_hash)
  const documentState = (d: DocumentLite) => hashState(d.ai_hash, d.text_hash)
  const needsWork = (s: HashState) => s.kind === 'pending' || s.kind === 'retry' || s.kind === 'partial'

  const classifyPending = content.filter((c) => needsWork(classifyState(c)))
  let extractPending = content.filter((c) => needsWork(extractState(c)))
  let announcementPending = announcements.filter((a) => needsWork(announcementState(a)))
  const documentPending = documents.filter((d) => needsWork(documentState(d)))

  const isDoneState = (s: HashState) => s.kind === 'done'
  result.skippedUnchanged =
    content.filter((c) => isDoneState(classifyState(c))).length +
    content.filter((c) => isDoneState(extractState(c))).length +
    announcements.filter((a) => isDoneState(announcementState(a))).length +
    documents.filter((d) => isDoneState(documentState(d))).length
  const isFailed = (s: HashState) => s.kind === 'failed'
  result.failed =
    content.filter((c) => isFailed(classifyState(c))).length +
    content.filter((c) => isFailed(extractState(c))).length +
    announcements.filter((a) => isFailed(announcementState(a))).length +
    documents.filter((d) => isFailed(documentState(d))).length

  /**
   * The stored hash value of a source before this unit. A source whose value
   * was null is new or was re-queued: its removals never re-queue others.
   */
  const storedBefore = new Map<string, string | null>()
  for (const c of content) storedBefore.set(c.id, aiByContent.get(c.id)?.extracted_hash ?? null)
  for (const a of announcements) storedBefore.set(a.id, a.ai_hash)
  for (const d of documents) storedBefore.set(d.id, d.ai_hash)
  const triggers = (lost: LostKeyDate[]) => lost.filter((r) => (storedBefore.get(sourceIdOf(r)) ?? null) !== null)

  const requeue = (lost: LostKeyDate[], exclude: Set<string>) =>
    requeueMentions(store, triggers(lost), exclude, { content, aiByContent, announcements, documents, contentById })

  // Free bookkeeping first: texts with no date signal are done without a call.
  const quietAnnouncements = announcementPending.filter((a) => !hasDateSignal(`${a.title}\n${a.body_text ?? ''}`))
  const quietContent = extractPending.filter((c) => !hasDateSignal(`${c.title}\n${c.body_text ?? ''}`))
  if (quietAnnouncements.length || quietContent.length) {
    try {
      const exclude = new Set([...quietAnnouncements.map((a) => a.id), ...quietContent.map((c) => c.id)])
      if (quietAnnouncements.length) {
        const ids = quietAnnouncements.map((a) => a.id)
        // Re-queue first: if anything below fails, this unit runs again.
        result.requeued += await requeue(await store.loadSuggestedFrom('announcement', ids), exclude)
        result.removed += await store.removeSuggestedFrom('announcement', ids)
        await store.markAnnouncements(quietAnnouncements.map((a) => ({ id: a.id, ai_hash: a.body_hash })))
      }
      if (quietContent.length) {
        const ids = quietContent.map((c) => c.id)
        result.requeued += await requeue(await store.loadSuggestedFrom('content', ids), exclude)
        result.removed += await store.removeSuggestedFrom('content', ids)
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

  // Rows marked retry: go alone, after the normal batches.
  const isRetry = (s: HashState) => s.kind === 'retry'
  const extractPlan = <T>(rows: T[], retry: (r: T) => boolean, toSource: (r: T) => ExtractSource, limits: typeof CONTENT_LIMITS) => [
    ...planExtractBatches(rows.filter((r) => !retry(r)).map(toSource), limits),
    ...rows.filter(retry).map((r) => [prepareSource(toSource(r), limits.maxChars)]),
  ]
  const plan: Plan = {
    classify: [
      ...planClassifyBatches(classifyPending.filter((c) => !isRetry(classifyState(c)))),
      ...classifyPending.filter((c) => isRetry(classifyState(c))).map((c) => [c]),
    ],
    announcements: extractPlan(announcementPending, (a) => isRetry(announcementState(a)), announcementSource, ANNOUNCEMENT_LIMITS),
    content: extractPlan(extractPending, (c) => isRetry(extractState(c)), contentSource, CONTENT_LIMITS),
    documents: documentPending,
  }
  const total = unitCount(plan)
  if (total === 0) return { ...result, remaining: result.requeued }

  const contextFor = (courseId: string) => {
    const course = courseById.get(courseId)
    return {
      moduleCode: course?.module_code ?? null,
      courseName: course?.name ?? null,
      window: academicWindow(course?.term, today),
    }
  }

  /**
   * `left`: units this one leaves behind besides the rest of the plan (a
   * split batch's single retries, an unfinished document).
   */
  const finish = (unit: ProcessUnit, extra: Partial<ProcessResult>, left = 0): ProcessResult => {
    const requeued = result.requeued + (extra.requeued ?? 0)
    return {
      ...result,
      ...extra,
      processed: result.processed + (extra.processed ?? 0),
      removed: result.removed + (extra.removed ?? 0),
      failed: result.failed + (extra.failed ?? 0),
      requeued,
      unit,
      calls,
      remaining: (extra.error || extra.budgetHit ? total : total - 1 + left) + requeued,
    }
  }

  const fail = (unit: ProcessUnit, err: unknown): ProcessResult => {
    if (isBudgetError(err)) return finish(unit, { budgetHit: true })
    return finish(unit, { error: message(err) })
  }

  /**
   * A batch whose reply was unusable: several rows → each marked retry:<hash>
   * (sent alone next); one row → fail:<hash> (left until a manual retry).
   * Any other error marks nothing and stops, as before.
   */
  const batchFailed = async (
    unit: ProcessUnit,
    err: unknown,
    rows: { id: string; hash: string }[],
    write: (rows: { id: string; marker: string }[]) => Promise<void>
  ): Promise<ProcessResult> => {
    if (!isBatchError(err)) return fail(unit, err)
    const split = rows.length > 1
    try {
      await write(rows.map((r) => ({ id: r.id, marker: split ? retryMarker(r.hash) : failMarker(r.hash) })))
    } catch (writeErr) {
      return fail(unit, writeErr)
    }
    const why = message(err).slice(0, 120)
    return finish(
      unit,
      {
        failed: split ? 0 : 1,
        note: split
          ? `A batch of ${rows.length} got an unusable reply (${why}); they will be sent one at a time.`
          : `One item got an unusable reply twice (${why}); it is marked failed until you retry it.`,
      },
      split ? rows.length : 0
    )
  }

  // ---- classify
  if (plan.classify.length) {
    const batch = plan.classify[0]
    let reply: { rows: Classification[]; model: string }
    try {
      const ctx = contextFor(batch[0].course_id)
      reply = await attempt(() => runClassifyBatch(batch, ctx, ai))
    } catch (err) {
      return batchFailed(
        'classify',
        err,
        batch.map((c) => ({ id: c.id, hash: c.body_hash })),
        (rows) => store.markClassified(rows.map((r) => ({ content_id: r.id, classified_hash: r.marker })))
      )
    }
    try {
      const hashById = new Map(batch.map((r) => [r.id, r.body_hash]))
      await store.saveClassifications(
        reply.rows.map((r) => ({ ...r, classified_hash: hashById.get(r.content_id) as string, model: reply.model }))
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
    const courseId = batch[0].course_id
    const hashById =
      extractUnit === 'announcements'
        ? new Map(announcementPending.map((a) => [a.id, a.body_hash]))
        : new Map(extractPending.map((c) => [c.id, c.body_hash]))
    const markBatch = (rows: { id: string; marker: string | null }[]) =>
      extractUnit === 'announcements'
        ? store.markAnnouncements(rows.map((r) => ({ id: r.id, ai_hash: r.marker })))
        : store.markContentExtracted(rows.map((r) => ({ content_id: r.id, extracted_hash: r.marker })))

    let extracted: Extracted
    try {
      extracted = await extractFound(store, [batch], courseId, contextFor(courseId), today, ai, attempt)
    } catch (err) {
      return batchFailed(extractUnit, err, batch.map((s) => ({ id: s.id, hash: hashById.get(s.id) as string })), markBatch)
    }
    try {
      const existing = await store.loadKeyDates(courseId)
      const { merge, lost } = mergeSources(existing, extracted.bySource)
      const requeued = await requeue(lost, new Set(batch.map((s) => s.id)))
      const counts = await store.applyKeyDates(merge, extracted.model)
      await markBatch(batch.map((s) => ({ id: s.id, marker: hashById.get(s.id) as string })))
      return finish(extractUnit, {
        processed: batch.length,
        added: counts.added,
        updated: counts.updated,
        removed: counts.removed,
        requeued,
        ...extracted.dropped,
        note: batch.some((s) => s.truncated) ? 'A long text was cut to fit one call.' : undefined,
      })
    } catch (err) {
      return fail(extractUnit, err)
    }
  }

  // ---- one document (or the next part of one)
  const doc = plan.documents[0]
  const owner = contentById.get(doc.content_id) as ContentLite
  const courseId = owner.course_id
  const docState = documentState(doc)
  let text: string
  try {
    text = (await store.loadDocumentText(doc.id)) ?? ''
  } catch (err) {
    return fail('document', err)
  }
  // Chunks with no date signal cost nothing and aren't counted.
  const signal = chunkDocument(text, MAX_CALL_CHARS - 400)
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

  if (signal.length === 0) {
    try {
      const requeued = await requeue(await store.loadSuggestedFrom('document', [doc.id]), new Set([doc.id]))
      const removed = await store.removeSuggestedFrom('document', [doc.id])
      await store.markDocument(doc.id, doc.text_hash)
      return finish('document', { processed: 1, skippedNoSignal: result.skippedNoSignal + 1, removed, requeued })
    } catch (err) {
      return fail('document', err)
    }
  }

  const resume = docState.kind === 'partial' && docState.next > 0 && docState.next < signal.length ? docState.next : 0
  const step = signal.slice(resume, resume + MAX_DOCUMENT_CHUNKS)
  const end = resume + step.length
  const final = end >= signal.length
  const pages = (from: number, to: number) => `pages ${signal[from].pages!.first}-${signal[to - 1].pages!.last}`
  const note =
    resume === 0 && final
      ? undefined
      : `${doc.file_name}: read parts ${resume + 1}-${end} of ${signal.length} with dates (${pages(resume, end)})${final ? '; finished.' : '; the rest follows in the next unit.'}`

  if (deps.budgetRemaining) {
    try {
      const left = await deps.budgetRemaining()
      if (left < step.length) return finish('document', { budgetHit: true, note })
    } catch (err) {
      return fail('document', err)
    }
  }

  let extracted: Extracted
  try {
    extracted = await extractFound(
      store,
      step.map((s) => [s]),
      courseId,
      contextFor(courseId),
      today,
      ai,
      attempt
    )
  } catch (err) {
    return batchFailed('document', err, [{ id: doc.id, hash: doc.text_hash }], (rows) =>
      store.markDocument(doc.id, rows[0].marker)
    )
  }

  // Rows found in parts read by an earlier unit of this pass are not stale:
  // an unfinished pass removes nothing; the last part removes only rows
  // whose quote isn't in an earlier part.
  const earlier = signal.slice(0, resume).map((s) => quoteHaystack(s.title, s.text))
  const keep: MergeOptions['keep'] = final
    ? (row) => {
        const q = normaliseQuote(row.quote)
        return q.length > 0 && earlier.some((h) => h.includes(q))
      }
    : () => true
  try {
    const existing = await store.loadKeyDates(courseId)
    const { merge, lost } = mergeSources(existing, extracted.bySource, keep)
    const requeued = await requeue(lost, new Set([doc.id]))
    const counts = await store.applyKeyDates(merge, extracted.model)
    await store.markDocument(doc.id, final ? doc.text_hash : partialMarker(end, doc.text_hash))
    return finish(
      'document',
      {
        processed: final ? 1 : 0,
        added: counts.added,
        updated: counts.updated,
        removed: counts.removed,
        requeued,
        ...extracted.dropped,
        note,
      },
      final ? 0 : 1
    )
  } catch (err) {
    return fail('document', err)
  }
}

// ------------------------------------------------------------ extraction --

interface Extracted {
  /** Found key dates per source id (document chunks all share their document's id). */
  bySource: Map<string, { kind: KeyDateSourceKind; found: FoundKeyDate[] }>
  model: string | null
  dropped: Pick<ProcessResult, 'ungrounded' | 'dateMismatch' | 'noAnchor' | 'invalid'>
}

/**
 * The model calls for one course's sources: `groups` is one batch of several
 * sources (announcements / content) or one single-source batch per document
 * chunk (run DOCUMENT_CONCURRENCY at a time). Writes nothing; throws when
 * any call fails, so nothing is written unless every call succeeded.
 */
async function extractFound(
  store: WorkStore,
  groups: ExtractSource[][],
  courseId: string,
  course: { moduleCode: string | null; courseName: string | null; window: { from: string; to: string } },
  today: string,
  ai: AiCall,
  attempt: <T>(run: () => Promise<T>) => Promise<T>
): Promise<Extracted> {
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
  const results: ExtractBatchResult[] = await pool(
    groups.map((group) => () => attempt(() => runExtractBatch(group, ctx, assignments, ai))),
    DOCUMENT_CONCURRENCY
  )

  const bySource: Extracted['bySource'] = new Map()
  groups.forEach((group, g) =>
    group.forEach((s, i) => {
      const entry = bySource.get(s.id) ?? { kind: s.kind, found: [] }
      entry.found.push(...results[g].perSource[i])
      bySource.set(s.id, entry)
    })
  )
  const sum = (key: 'ungrounded' | 'dateMismatch' | 'noAnchor' | 'invalid') => results.reduce((n, r) => n + r[key], 0)
  return {
    bySource,
    model: results.find((r) => r.model)?.model ?? null,
    dropped: { ungrounded: sum('ungrounded'), dateMismatch: sum('dateMismatch'), noAnchor: sum('noAnchor'), invalid: sum('invalid') },
  }
}

/**
 * One merge per source against the course's key dates, combined, plus the
 * suggested rows that leave their day (removed or moved).
 *
 * Two phases, so the order of sources in a batch can't lose a deadline: each
 * source's stale rows are worked out first (they depend only on its own rows
 * and finds), then sources merge in turn against what is left, each seeing
 * the earlier ones' inserts (a deadline in two announcements of one batch is
 * inserted once, and never matched against a row another source is about to
 * remove).
 */
function mergeSources(
  existing: ExistingKeyDate[],
  bySource: Extracted['bySource'],
  keep?: MergeOptions['keep']
): { merge: KeyDateMerge; lost: LostKeyDate[] } {
  const remove = new Set<string>()
  for (const [id, { kind, found }] of bySource) {
    for (const r of mergeKeyDates(existing, found, { kind, id }, { keep }).remove) remove.add(r)
  }

  let working = existing.filter((r) => !remove.has(r.id))
  const combined: KeyDateMerge = { insert: [], update: [], remove: [...remove] }
  let pendingId = 0
  for (const [id, { kind, found }] of bySource) {
    const merge = mergeKeyDates(working, found, { kind, id }, { keep })
    combined.insert.push(...merge.insert)
    combined.update.push(...merge.update)
    const patches = new Map(merge.update.map((u) => [u.id, u.patch]))
    working = working
      .map((r) => (patches.has(r.id) ? { ...r, ...patches.get(r.id) } : r))
      .concat(merge.insert.map((r) => ({ ...r, id: `pending:${pendingId++}` })))
  }

  const byId = new Map(existing.map((r) => [r.id, r]))
  const lost: LostKeyDate[] = []
  const lose = (r: ExistingKeyDate) =>
    lost.push({
      id: r.id,
      course_id: r.course_id,
      due_on: r.due_on,
      announcement_id: r.announcement_id,
      content_id: r.content_id,
      document_id: r.document_id,
    })
  for (const id of remove) lose(byId.get(id) as ExistingKeyDate)
  for (const u of combined.update) {
    const row = byId.get(u.id)
    if (row && u.patch.due_on !== undefined && u.patch.due_on !== row.due_on) lose(row)
  }
  return { merge: combined, lost }
}

// --------------------------------------------------------------- requeue --

interface RequeueState {
  content: ContentLite[]
  aiByContent: Map<string, ContentAiLite>
  announcements: AnnouncementLite[]
  documents: DocumentLite[]
  contentById: Map<string, ContentLite>
}

/**
 * A suggested row is about to leave its day. Another source of the course
 * may have stated the same deadline and been merged into that row (nothing
 * of its own inserted): clear the processed hash of every other done source
 * of the course that mentions the day, so the next unit reads it again.
 * Returns how many sources were re-queued.
 */
async function requeueMentions(store: WorkStore, lost: LostKeyDate[], exclude: Set<string>, s: RequeueState): Promise<number> {
  if (lost.length === 0) return 0
  const daysByCourse = new Map<string, Set<string>>()
  for (const r of lost) daysByCourse.set(r.course_id, (daysByCourse.get(r.course_id) ?? new Set()).add(r.due_on))
  const daysFor = (courseId: string) => [...(daysByCourse.get(courseId) ?? [])]

  const announcements = s.announcements.filter((a) => {
    const days = daysFor(a.course_id)
    if (!days.length || exclude.has(a.id) || hashState(a.ai_hash, a.body_hash).kind !== 'done') return false
    const text = `${a.title}\n${a.body_text ?? ''}`
    return days.some((d) => mentionsDate(text, d) || mentionsRelatively(text, d, a.posted_at))
  })
  const content = s.content.filter((c) => {
    const days = daysFor(c.course_id)
    if (!days.length || exclude.has(c.id) || hashState(s.aiByContent.get(c.id)?.extracted_hash, c.body_hash).kind !== 'done') return false
    const text = `${c.title}\n${c.body_text ?? ''}`
    return days.some((d) => mentionsDate(text, d))
  })
  const documents: DocumentLite[] = []
  for (const d of s.documents) {
    const courseId = s.contentById.get(d.content_id)?.course_id
    const days = courseId ? daysFor(courseId) : []
    const kind = hashState(d.ai_hash, d.text_hash).kind
    if (!days.length || exclude.has(d.id) || (kind !== 'done' && kind !== 'partial')) continue
    const text = `${d.file_name}\n${(await store.loadDocumentText(d.id)) ?? ''}`
    if (days.some((day) => mentionsDate(text, day))) documents.push(d)
  }

  if (announcements.length) await store.markAnnouncements(announcements.map((a) => ({ id: a.id, ai_hash: null })))
  if (content.length) await store.markContentExtracted(content.map((c) => ({ content_id: c.id, extracted_hash: null })))
  for (const d of documents) await store.markDocument(d.id, null)
  return announcements.length + content.length + documents.length
}

/** The manual retry: every `fail:` marker that still matches its text becomes `retry:`. */
async function clearFailMarkers(
  store: WorkStore,
  content: ContentLite[],
  aiByContent: Map<string, ContentAiLite>,
  announcements: AnnouncementLite[],
  documents: DocumentLite[]
): Promise<void> {
  const failed = (stored: string | null | undefined, hash: string) => hashState(stored, hash).kind === 'failed'
  const classify = content.filter((c) => failed(aiByContent.get(c.id)?.classified_hash, c.body_hash))
  const extract = content.filter((c) => failed(aiByContent.get(c.id)?.extracted_hash, c.body_hash))
  const anns = announcements.filter((a) => failed(a.ai_hash, a.body_hash))
  const docs = documents.filter((d) => failed(d.ai_hash, d.text_hash))

  if (classify.length) await store.markClassified(classify.map((c) => ({ content_id: c.id, classified_hash: retryMarker(c.body_hash) })))
  if (extract.length) await store.markContentExtracted(extract.map((c) => ({ content_id: c.id, extracted_hash: retryMarker(c.body_hash) })))
  if (anns.length) await store.markAnnouncements(anns.map((a) => ({ id: a.id, ai_hash: retryMarker(a.body_hash) })))
  for (const d of docs) await store.markDocument(d.id, retryMarker(d.text_hash))

  // Keep this call's view in step with what was written.
  for (const c of classify) aiByContent.get(c.id)!.classified_hash = retryMarker(c.body_hash)
  for (const c of extract) aiByContent.get(c.id)!.extracted_hash = retryMarker(c.body_hash)
  for (const a of anns) a.ai_hash = retryMarker(a.body_hash)
  for (const d of docs) d.ai_hash = retryMarker(d.text_hash)
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

    async markClassified(rows) {
      if (!rows.length) return
      const updated_at = stamp()
      // Only the hash column: an existing classification is kept, a new row
      // gets role 'other' by default.
      const { error } = await supabase.from('bb_content_ai').upsert(
        rows.map((r) => ({ user_id: userId, content_id: r.content_id, classified_hash: r.classified_hash, updated_at })),
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

    async loadSuggestedFrom(kind, ids) {
      const out: LostKeyDate[] = []
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await supabase
          .from('bb_key_dates')
          .select('id, course_id, due_on, announcement_id, content_id, document_id')
          .in(SOURCE_COLUMN[kind], ids.slice(i, i + 200))
          .eq('status', 'suggested')
        check(error)
        out.push(...((data ?? []) as LostKeyDate[]))
      }
      return out
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
