// The safety layer between the model and bb_key_dates: code decides what is
// kept, never the model. An AI item survives only when its quote really is
// in the source, its date is a real day inside the academic year, and it
// doesn't bring back something I dismissed or overwrite something I
// confirmed. Pure: no server-only, Next or Supabase imports (node:crypto for
// md5 only).

import { createHash } from 'node:crypto'
import { londonDateKey, londonDateTimeToUTCISO } from '@/lib/google/london-day'
import { academicYearStart, isDateKey } from '@/lib/blackboard/dates'
import type { BbKeyDate, BbKeyDateCategory } from '@/lib/blackboard/types'
import { hasDateSignal } from './prefilter'

// ------------------------------------------------------------- grounding --

export const MIN_QUOTE_CHARS = 8
/** How far from the quote a date signal may sit. */
export const SIGNAL_WINDOW = 200

/** Whitespace collapsed, typographic quotes / dashes made plain. Case kept. */
function normaliseText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface GroundSource {
  title: string
  text: string
}

/** The fields grounding reads from a validated model item. `source` is 1-based. */
export interface Groundable {
  source: number
  quote: string
}

/**
 * Keeps an item only when its quote (whitespace-normalised, case-insensitive)
 * is a substring of its source's title + text, is at least 8 characters, and
 * contains a date signal or sits within 200 characters of one. Everything
 * else is dropped and counted as `ungrounded`.
 */
export function groundItems<T extends Groundable>(items: T[], sources: GroundSource[]): { kept: T[]; ungrounded: number } {
  const prepared = sources.map((s) => {
    const cased = normaliseText(`${s.title}\n${s.text}`)
    const lower = cased.toLowerCase()
    // toLowerCase can change length for a handful of characters; positions
    // are only used for the signal window, so fall back to the lower text.
    return { lower, cased: lower.length === cased.length ? cased : lower }
  })
  const kept: T[] = []
  let ungrounded = 0
  for (const item of items) {
    const src = prepared[item.source - 1]
    const quote = normaliseText(item.quote ?? '')
    const needle = quote.toLowerCase()
    const at = src && needle.length >= MIN_QUOTE_CHARS ? src.lower.indexOf(needle) : -1
    if (!src || at < 0) {
      ungrounded++
      continue
    }
    const around = src.cased.slice(Math.max(0, at - SIGNAL_WINDOW), at + needle.length + SIGNAL_WINDOW)
    if (!hasDateSignal(quote) && !hasDateSignal(around)) {
      ungrounded++
      continue
    }
    kept.push(item)
  }
  return { kept, ungrounded }
}

// ----------------------------------------------------------------- dates --

export interface DateWindow {
  /** Inclusive 'YYYY-MM-DD'. */
  from: string
  to: string
}

/**
 * 1 Aug of the course's term year → 30 Sep of the year after (term '2026' →
 * 2026-08-01 … 2027-09-30). With no usable term, the academic year `today`
 * falls in.
 */
export function academicWindow(term: string | null | undefined, today: string): DateWindow {
  const year = term && /^\d{4}$/.test(term.trim()) ? Number(term.trim()) : academicYearStart(today)
  return { from: `${year}-08-01`, to: `${year + 1}-09-30` }
}

/** A real calendar date inside the window. */
export function validDueDate(iso: unknown, window: DateWindow): iso is string {
  return isDateKey(iso) && iso >= window.from && iso <= window.to
}

/** Europe/London wall time on `due_on` → UTC ISO instant; null without a valid time. */
export function toDueAt(dueOn: string, dueTime: string | null | undefined): string | null {
  if (!dueTime || !isDateKey(dueOn)) return null
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(dueTime)
  if (!m) return null
  return londonDateTimeToUTCISO(dueOn, `${m[1]}:${m[2]}`)
}

// ---------------------------------------------------------- title tokens --

const STOP_WORDS = new Set(
  (
    'a an the of for to and or in on at by with from into onto your you my our their this that these those it its is are be ' +
    'will must should please can may all any each per via about before after until no not due deadline deadlines submit ' +
    'submission submissions submitted hand handin complete completion prepare preparation upload uploaded attend ' +
    'first second third fourth fifth sixth seventh eighth ninth tenth i ii iii iv v vi vii viii ix x ' +
    'am pm noon midday midnight today tomorrow week next'
  ).split(' ')
)

const MONTH_WORD =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const WEEKDAY_WORD = '(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|rsday|urday|sday)?'
const DATE_BITS = [
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_WORD}\\b\\.?(?:,?\\s+\\d{4})?`, 'gi'),
  new RegExp(`\\b${MONTH_WORD}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b(?:,?\\s+\\d{4})?`, 'gi'),
  /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g,
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b/gi,
  /\b\d{1,2}[:.]\d{2}\b/g,
  new RegExp(`\\b${MONTH_WORD}\\b`, 'gi'),
  new RegExp(`\\b${WEEKDAY_WORD}\\b`, 'gi'),
]

/**
 * The significant words of a title: lower case, dates / times / weekdays /
 * months, ordinals, stop-words and punctuation removed, a plural "s" dropped.
 */
export function titleTokens(title: string): Set<string> {
  let text = normaliseText(title).toLowerCase()
  for (const re of DATE_BITS) text = text.replace(re, ' ')
  const out = new Set<string>()
  for (const raw of text.split(/[^\p{L}\p{N}]+/u)) {
    if (!raw || STOP_WORDS.has(raw)) continue
    if (/^\d+(?:st|nd|rd|th)$/.test(raw)) continue
    if (/^(?:19|20)\d{2}$/.test(raw)) continue
    const word = raw.length > 3 && raw.endsWith('s') && !raw.endsWith('ss') ? raw.slice(0, -1) : raw
    if (!STOP_WORDS.has(word)) out.add(word)
  }
  return out
}

/** Jaccard similarity of two titles' token sets (0 when either is empty). */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a)
  const tb = titleTokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / (ta.size + tb.size - shared)
}

/**
 * md5 of course id + date + the sorted token set, so a reworded title on the
 * same day usually maps to the same fingerprint (bb_key_dates is unique on
 * user_id + fingerprint).
 */
export function keyDateFingerprint({ course_id, due_on, title }: { course_id: string; due_on: string; title: string }): string {
  const tokens = [...titleTokens(title)].sort()
  const key = tokens.length ? tokens.join(' ') : normaliseText(title).toLowerCase()
  return createHash('md5').update(`${course_id}|${due_on}|${key}`).digest('hex')
}

// ------------------------------------------------------------ assignments --

export interface AssignmentLite {
  id: string
  course_id: string
  title: string
  due_at: string | null
}

export const SAME_ITEM_SIMILARITY = 0.5
export const ASSIGNMENT_SIMILARITY = 0.4

/**
 * The official assignment this key date duplicates: same course, due on the
 * same London day, and a similar title. The model's `matches_assignment`
 * (1-based into `assignments`, the list the prompt showed) is honoured only
 * when the dates agree.
 */
export function linkToAssignment(
  item: { course_id: string; due_on: string; title: string; matches_assignment?: number | null },
  assignments: AssignmentLite[]
): string | null {
  const day = (a: AssignmentLite) => (a.due_at ? londonDateKey(a.due_at) : null)
  if (item.matches_assignment) {
    const hinted = assignments[item.matches_assignment - 1]
    if (hinted && hinted.course_id === item.course_id && day(hinted) === item.due_on) return hinted.id
  }
  let best: { id: string; score: number } | null = null
  for (const a of assignments) {
    if (a.course_id !== item.course_id || day(a) !== item.due_on) continue
    const score = titleSimilarity(a.title, item.title)
    if (score >= ASSIGNMENT_SIMILARITY && (!best || score > best.score)) best = { id: a.id, score }
  }
  return best?.id ?? null
}

// ----------------------------------------------------------------- merge --

export type KeyDateSourceKind = 'announcement' | 'content' | 'document'

export interface KeyDateSource {
  kind: KeyDateSourceKind
  id: string
}

export type ExistingKeyDate = Pick<
  BbKeyDate,
  | 'id'
  | 'course_id'
  | 'announcement_id'
  | 'content_id'
  | 'document_id'
  | 'title'
  | 'category'
  | 'due_on'
  | 'ai_due_on'
  | 'due_at'
  | 'for_session_type'
  | 'for_week'
  | 'quote'
  | 'status'
  | 'assignment_id'
  | 'fingerprint'
>

/** A grounded, validated key date found in one source this pass. */
export interface FoundKeyDate {
  course_id: string
  title: string
  category: BbKeyDateCategory
  due_on: string
  due_at: string | null
  for_session_type: string | null
  for_week: number | null
  quote: string
  assignment_id: string | null
  fingerprint: string
}

export interface NewKeyDate extends FoundKeyDate {
  announcement_id: string | null
  content_id: string | null
  document_id: string | null
  ai_due_on: string
  status: 'suggested'
}

export type KeyDatePatch = Partial<Omit<FoundKeyDate, 'course_id'> & { ai_due_on: string }>

export interface KeyDateMerge {
  insert: NewKeyDate[]
  update: { id: string; patch: KeyDatePatch }[]
  remove: string[]
}

const SOURCE_COLUMN = {
  announcement: 'announcement_id',
  content: 'content_id',
  document: 'document_id',
} as const satisfies Record<KeyDateSourceKind, keyof ExistingKeyDate>

function sameItem(a: { course_id: string; fingerprint: string; title: string }, b: FoundKeyDate): boolean {
  return a.course_id === b.course_id && (a.fingerprint === b.fingerprint || titleSimilarity(a.title, b.title) >= SAME_ITEM_SIMILARITY)
}

const PATCH_FIELDS = [
  'title',
  'category',
  'due_on',
  'due_at',
  'for_session_type',
  'for_week',
  'quote',
  'assignment_id',
  'fingerprint',
] as const

function diff(row: ExistingKeyDate, found: FoundKeyDate, keepTitle: boolean): KeyDatePatch {
  const patch: Record<string, unknown> = {}
  for (const field of PATCH_FIELDS) {
    if (keepTitle && (field === 'title' || field === 'fingerprint')) continue
    if (row[field] !== found[field]) patch[field] = found[field]
  }
  if (row.ai_due_on !== found.due_on) patch.ai_due_on = found.due_on
  return patch as KeyDatePatch
}

/**
 * What one source's new pass means for bb_key_dates.
 *
 * - `existing` is every key date of the source's course(s), from ANY source.
 * - An existing row with the same course, the same day (its due_on, or the
 *   ai_due_on it was found at before I edited it) and a similar title
 *   (token similarity ≥ 0.5, or the same fingerprint) is the same item: never
 *   inserted again. That's how a dismissed row stays dismissed and how a
 *   deadline in both an announcement and an item title collapses to one.
 * - Dismissed and confirmed rows are never changed or removed.
 * - This source's own suggested rows are updated when the found item differs
 *   (including a moved date, matched on title alone) and removed when the
 *   new pass no longer finds them. Rows from other sources are never removed.
 */
export function mergeKeyDates(existing: ExistingKeyDate[], found: FoundKeyDate[], source: KeyDateSource): KeyDateMerge {
  const column = SOURCE_COLUMN[source.kind]
  const isOwn = (r: ExistingKeyDate) => r[column] === source.id
  const onDay = (r: ExistingKeyDate, day: string) => r.due_on === day || r.ai_due_on === day

  // Duplicates inside this pass (the same deadline quoted twice) collapse first.
  const unique: FoundKeyDate[] = []
  for (const f of found) {
    if (!unique.some((u) => u.due_on === f.due_on && sameItem(u, f))) unique.push(f)
  }

  const takenFingerprints = new Set(existing.map((r) => r.fingerprint))
  const claimed = new Set<string>()
  const insert: NewKeyDate[] = []
  const update: { id: string; patch: KeyDatePatch }[] = []
  const unmatched: FoundKeyDate[] = []

  for (const f of unique) {
    const matches = existing.filter((r) => onDay(r, f.due_on) && sameItem(r, f))
    if (matches.length === 0) {
      unmatched.push(f)
      continue
    }
    const own = matches.find((r) => isOwn(r) && !claimed.has(r.id))
    const row = own ?? matches[0]
    if (!isOwn(row) || claimed.has(row.id)) continue
    claimed.add(row.id)
    if (row.status !== 'suggested') continue
    // Never move a row onto a fingerprint another row already holds.
    const keepTitle = f.fingerprint !== row.fingerprint && takenFingerprints.has(f.fingerprint)
    const patch = diff(row, f, keepTitle)
    if (Object.keys(patch).length === 0) continue
    if (patch.fingerprint) takenFingerprints.add(patch.fingerprint)
    update.push({ id: row.id, patch })
  }

  for (const f of unmatched) {
    if (takenFingerprints.has(f.fingerprint)) continue
    // Same source, still only suggested, similar title, different day: the date moved.
    const moved = existing.find(
      (r) =>
        isOwn(r) &&
        r.status === 'suggested' &&
        !claimed.has(r.id) &&
        r.course_id === f.course_id &&
        titleSimilarity(r.title, f.title) >= SAME_ITEM_SIMILARITY
    )
    takenFingerprints.add(f.fingerprint)
    if (moved) {
      claimed.add(moved.id)
      update.push({ id: moved.id, patch: diff(moved, f, false) })
      continue
    }
    insert.push({
      ...f,
      announcement_id: source.kind === 'announcement' ? source.id : null,
      content_id: source.kind === 'content' ? source.id : null,
      document_id: source.kind === 'document' ? source.id : null,
      ai_due_on: f.due_on,
      status: 'suggested',
    })
  }

  const remove = existing.filter((r) => isOwn(r) && r.status === 'suggested' && !claimed.has(r.id)).map((r) => r.id)
  return { insert, update, remove }
}
