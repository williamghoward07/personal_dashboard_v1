// The safety layer between the model and bb_key_dates: code decides what is
// kept, never the model. An AI item survives only when its quote really is
// in its own source, the quote itself states the date the item claims, its
// date is a real day inside the academic year, and it doesn't bring back
// something I dismissed or overwrite something I confirmed. Pure: no
// server-only, Next or Supabase imports (node:crypto for md5 only).

import { createHash } from 'node:crypto'
import { londonDateKey } from '@/lib/google/london-day'
import { academicYearStart, isDateKey } from '@/lib/blackboard/dates'
import type { BbKeyDate, BbKeyDateCategory } from '@/lib/blackboard/types'
import { anchorDay, datesIn, hasRelativeSignal, timesIn } from './quote-dates'
import { absoluteDateOk, checkRelativeWithSessions, type ModuleSession } from './sessions'

// ------------------------------------------------------------- grounding --

export const MIN_QUOTE_CHARS = 8

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

/** A quote as compared between rows: normalised, lower case, no trailing punctuation. */
export function normaliseQuote(quote: string | null | undefined): string {
  return normaliseText(quote ?? '')
    .toLowerCase()
    .replace(/[\s.,;:!?]+$/, '')
}

export interface GroundSource {
  title: string
  text: string
  /**
   * When the source was posted ('YYYY-MM-DD' or an ISO instant). Only a
   * source with a posted day can yield a relative-only date ("next week").
   */
  anchor?: string | null
}

/** The fields grounding reads from a validated model item. `source` is 1-based. */
export interface Groundable {
  source: number
  quote: string
  due_on: string
  due_time?: string | null
}

export interface GroundResult<T> {
  /** Kept items; `due_time` is null unless the quote states that time. */
  kept: T[]
  /** Quote not in its own source, too short, or with no date in it. */
  ungrounded: number
  /** The quote states a different date than `due_on`. */
  dateMismatch: number
  /** Only a relative date ("next week") in a source with no posted day. */
  noAnchor: number
}

/**
 * Keeps an item only when:
 * - its quote (whitespace-normalised, case-insensitive, at least 8
 *   characters) is a substring of ITS OWN source's title + text;
 * - the quote itself states a date: an absolute one (`due_on` must equal it
 *   or fall inside its range), or else a relative one ("next week",
 *   "Tuesday's tutorial", "week 14"), accepted only for a source with a
 *   posted day when `due_on` is 0-21 days after it and on the weekday the
 *   quote names;
 * - `due_time` survives only when the quote states that time.
 * `yearStart` places dates written without a year (academicWindow's year).
 *
 * With the module's `sessions` (the list the prompt showed), work set for a
 * session must land on that session (sessions.ts): a quote naming a kind of
 * session ("tutorial", "lecture", "class") with only a relative date or a
 * week range must give the day of a session of that kind in that period
 * when the list has one; a relative quote naming no session may also give
 * the module's next session day after the posted day. A single written date
 * still wins outright. Without sessions the rules are exactly the above.
 */
export function groundItems<T extends Groundable>(
  items: T[],
  sources: GroundSource[],
  ctx: { yearStart: number; sessions?: ModuleSession[] }
): GroundResult<T> {
  const sessions = ctx.sessions ?? []
  const prepared = sources.map((s) => ({ lower: normaliseText(`${s.title}\n${s.text}`).toLowerCase(), anchor: anchorDay(s.anchor) }))
  const out: GroundResult<T> = { kept: [], ungrounded: 0, dateMismatch: 0, noAnchor: 0 }
  for (const item of items) {
    const src = Number.isInteger(item.source) ? prepared[item.source - 1] : undefined
    const quote = normaliseText(item.quote ?? '')
    const needle = quote.toLowerCase()
    if (!src || needle.length < MIN_QUOTE_CHARS || !src.lower.includes(needle)) {
      out.ungrounded++
      continue
    }
    const dates = datesIn(quote, ctx)
    if (dates.length) {
      if (!absoluteDateOk(quote, item.due_on, dates, sessions)) {
        out.dateMismatch++
        continue
      }
    } else if (hasRelativeSignal(quote)) {
      const verdict = checkRelativeWithSessions(quote, item.due_on, src.anchor, sessions)
      if (verdict === 'no_anchor') {
        out.noAnchor++
        continue
      }
      if (verdict === 'date_mismatch') {
        out.dateMismatch++
        continue
      }
    } else {
      out.ungrounded++
      continue
    }
    const time = item.due_time && timesIn(quote).includes(item.due_time) ? item.due_time : null
    out.kept.push(time === (item.due_time ?? null) ? item : { ...item, due_time: time })
  }
  return out
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

/** Europe/London's UTC offset in minutes at an instant (+60 in BST). */
function londonOffsetAt(epochMs: number): number {
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/London', timeZoneName: 'shortOffset' })
      .formatToParts(new Date(epochMs))
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name)
  if (!m) return 0
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0)
  return m[1] === '-' ? -minutes : minutes
}

/**
 * Europe/London wall time on `due_on` → UTC ISO instant; null without a
 * valid time. The offset is read at the target instant, not at midnight
 * (two passes: guess with the midnight offset, re-read the offset at the
 * guess), so clock-change Sundays come out right.
 */
export function toDueAt(dueOn: string, dueTime: string | null | undefined): string | null {
  if (!dueTime || !isDateKey(dueOn)) return null
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(dueTime)
  if (!m) return null
  const [y, mo, d] = dueOn.split('-').map(Number)
  const wall = Date.UTC(y, mo - 1, d, Number(m[1]), Number(m[2]))
  const guess = wall - londonOffsetAt(Date.UTC(y, mo - 1, d)) * 60_000
  return new Date(wall - londonOffsetAt(guess) * 60_000).toISOString()
}

// ---------------------------------------------------------- title tokens --

const STOP_WORDS = new Set(
  (
    'a an the of for to and or in on at by with from into onto your you my our their this that these those it its is are be ' +
    'will must should please can may all any each per via about before after until no not due deadline deadlines submit ' +
    'submission submissions submitted hand handin complete completion prepare preparation upload uploaded attend ' +
    'am pm noon midday midnight today tomorrow week next'
  ).split(' ')
)

const MONTH_WORD =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
// Whole date and time phrases only: the day is already in due_on, and "24
// November" vs "24 Nov" in two titles must not split one deadline. Bare
// numbers, years ("Smith (2020)"), weekdays and month words stay tokens.
const DATE_PHRASES = [
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_WORD}\\b\\.?(?:,?\\s+\\d{4})?`, 'gi'),
  new RegExp(`\\b${MONTH_WORD}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b(?:,?\\s+\\d{4})?`, 'gi'),
  /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g,
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b/gi,
  /\b\d{1,2}[:.]\d{2}\b/g,
]

// Number words, roman numerals and ordinals all become digits, so "Post I",
// "Post 1" and "first post" compare equal while "Post I" / "Post II" differ.
const NUMBER_WORDS: Record<string, string> = {}
const numberLists = [
  'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
  'first second third fourth fifth sixth seventh eighth ninth tenth',
  'i ii iii iv v vi vii viii ix x xi xii',
]
for (const list of numberLists) list.split(' ').forEach((w, i) => (NUMBER_WORDS[w] = String(i + 1)))

/** One lower-case word → its token, or null for a stop-word. */
function token(raw: string): string | null {
  if (!raw || STOP_WORDS.has(raw)) return null
  if (NUMBER_WORDS[raw]) return NUMBER_WORDS[raw]
  const number = /^0*(\d+)(?:st|nd|rd|th)?$/.exec(raw)
  if (number) return number[1]
  if (/^0+$/.test(raw)) return '0'
  const word = raw.length > 3 && raw.endsWith('s') && !raw.endsWith('ss') ? raw.slice(0, -1) : raw
  return STOP_WORDS.has(word) ? null : word
}

function stripDates(title: string): string {
  let text = normaliseText(title)
  for (const re of DATE_PHRASES) text = text.replace(re, ' ')
  return text
}

/**
 * The significant words of a title: lower case, whole date / time phrases,
 * stop-words and punctuation removed, a plural "s" dropped. Numbers (digits,
 * years, roman numerals, number words, ordinals) are kept, as digits.
 */
export function titleTokens(title: string): Set<string> {
  const out = new Set<string>()
  for (const raw of stripDates(title).toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    const t = token(raw)
    if (t) out.add(t)
  }
  return out
}

const isNumberToken = (t: string) => /^\d+$/.test(t)

/** Tokens of words capitalised after the first word ("Read Smith (2020)" → smith). */
function capitalisedTokens(title: string): Set<string> {
  const out = new Set<string>()
  stripDates(title)
    .split(/\s+/)
    .forEach((word, i) => {
      const bare = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
      if (i === 0 || !/^\p{Lu}/u.test(bare)) return
      for (const raw of bare.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
        const t = token(raw)
        if (t && !isNumberToken(t)) out.add(t)
      }
    })
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

/** True when the titles carry different numbers ("chapter 3" / "chapter 4", "Post I" / "Post II", 2020 / 2019). */
export function numbersDiffer(a: string, b: string): boolean {
  const numbers = (t: string) => [...titleTokens(t)].filter(isNumberToken).sort().join(' ')
  return numbers(a) !== numbers(b)
}

/** True when a word found in only one title is capitalised mid-title there (a name: "Smith" / "Jones"). */
export function properNounsDiffer(a: string, b: string): boolean {
  const ta = titleTokens(a)
  const tb = titleTokens(b)
  for (const t of capitalisedTokens(a)) if (!tb.has(t)) return true
  for (const t of capitalisedTokens(b)) if (!ta.has(t)) return true
  return false
}

/** Token similarity at which two same-category titles can be one item. */
export const SAME_TITLE_SIMILARITY = 0.8

/** The strict title test: very similar, no differing number, no differing name. */
export function sameTitle(a: string, b: string): boolean {
  return titleSimilarity(a, b) >= SAME_TITLE_SIMILARITY && !numbersDiffer(a, b) && !properNounsDiffer(a, b)
}

/**
 * md5 of course id + date + the sorted token set (numbers and names kept), so
 * only a title with the same significant words on the same day shares a
 * fingerprint (bb_key_dates is unique on user_id + fingerprint).
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

/** Same source, same day: this similar a title (with no differing number) is a reworded same item. */
export const SAME_SOURCE_SIMILARITY = 0.5
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

export interface MergeOptions {
  /**
   * Own rows this pass must neither remove nor move to another day (a long
   * document's rows found in chunks read by an earlier unit).
   */
  keep?: (row: ExistingKeyDate) => boolean
}

const SOURCE_COLUMN = {
  announcement: 'announcement_id',
  content: 'content_id',
  document: 'document_id',
} as const satisfies Record<KeyDateSourceKind, keyof ExistingKeyDate>

type Comparable = Pick<FoundKeyDate, 'course_id' | 'fingerprint' | 'title' | 'category' | 'quote'>

/**
 * THE SAME item (callers also require the same day): same course and the same
 * fingerprint, or the same normalised quote, or the same category with
 * strictly the same title (similarity ≥ 0.8, no differing number or name).
 * When unsure the answer is "different": a duplicate is acceptable, a lost
 * deadline is not.
 */
export function sameItem(a: Comparable, b: Comparable, { byQuote = true } = {}): boolean {
  if (a.course_id !== b.course_id) return false
  if (a.fingerprint === b.fingerprint) return true
  if (byQuote && normaliseQuote(a.quote) === normaliseQuote(b.quote)) return true
  return a.category === b.category && sameTitle(a.title, b.title)
}

/** Same source and day, looser: the quotes overlap, or a similar title with no differing number. */
function rewordedSameItem(row: ExistingKeyDate, f: FoundKeyDate): boolean {
  const a = normaliseQuote(row.quote)
  const b = normaliseQuote(f.quote)
  if (a && b && (a.includes(b) || b.includes(a))) return true
  return titleSimilarity(row.title, f.title) >= SAME_SOURCE_SIMILARITY && !numbersDiffer(row.title, f.title)
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
 * - A found item that is the same item (sameItem) as an existing row on the
 *   same day (its due_on, or the ai_due_on it was found at before I edited
 *   it) is never inserted again; it updates that row only when the row is
 *   this source's own and still suggested. That's how a deadline in both an
 *   announcement and an item title collapses to one, and how a dismissed row
 *   stays dismissed.
 * - Failing that, an own row on the same day whose quote overlaps the found
 *   quote, or whose title is similar (≥ 0.5) without a differing number, is
 *   the same item reworded: never inserted again (a dismissed date stays
 *   dismissed when the model rewords its title).
 * - Dismissed and confirmed rows are never changed or removed.
 * - This source's own suggested rows are updated when the found item differs
 *   (including a moved date, matched on a similar title) and removed when
 *   the new pass no longer finds them, unless `keep` protects them. Rows
 *   from other sources are never removed.
 */
export function mergeKeyDates(
  existing: ExistingKeyDate[],
  found: FoundKeyDate[],
  source: KeyDateSource,
  options: MergeOptions = {}
): KeyDateMerge {
  const column = SOURCE_COLUMN[source.kind]
  const isOwn = (r: ExistingKeyDate) => r[column] === source.id
  const kept = (r: ExistingKeyDate) => options.keep?.(r) ?? false
  const onDay = (r: ExistingKeyDate, day: string) => r.due_on === day || r.ai_due_on === day

  // Duplicates inside this pass (the same deadline quoted twice) collapse
  // first. A shared quote alone doesn't count here: the model listing two
  // items for one sentence means two items.
  const unique: FoundKeyDate[] = []
  for (const f of found) {
    if (!unique.some((u) => u.due_on === f.due_on && sameItem(u, f, { byQuote: false }))) unique.push(f)
  }

  const takenFingerprints = new Set(existing.map((r) => r.fingerprint))
  const claimed = new Set<string>()
  const insert: NewKeyDate[] = []
  const update: { id: string; patch: KeyDatePatch }[] = []

  const claim = (row: ExistingKeyDate, f: FoundKeyDate) => {
    claimed.add(row.id)
    if (row.status !== 'suggested') return
    // Never move a row onto a fingerprint another row already holds.
    const keepTitle = f.fingerprint !== row.fingerprint && takenFingerprints.has(f.fingerprint)
    const patch = diff(row, f, keepTitle)
    if (Object.keys(patch).length === 0) return
    if (patch.fingerprint) takenFingerprints.add(patch.fingerprint)
    update.push({ id: row.id, patch })
  }

  // 1. Strict matches, for every found item first, so a looser match below
  //    can never take a row another item matches exactly.
  const unmatched: { f: FoundKeyDate; elsewhere: boolean }[] = []
  for (const f of unique) {
    const matches = existing.filter((r) => onDay(r, f.due_on) && sameItem(r, f))
    const own = matches.find((r) => isOwn(r) && !claimed.has(r.id))
    if (own) claim(own, f)
    // `elsewhere`: another source already has it (whatever its status), so
    // it is never inserted again.
    else unmatched.push({ f, elsewhere: matches.some((r) => !isOwn(r)) })
  }

  // 2. The same item reworded, in this source on the same day.
  const fresh: FoundKeyDate[] = []
  for (const { f, elsewhere } of unmatched) {
    const row = existing.find((r) => isOwn(r) && !claimed.has(r.id) && onDay(r, f.due_on) && rewordedSameItem(r, f))
    if (row) claim(row, f)
    else if (!elsewhere) fresh.push(f)
  }

  // 3. A moved date, or a new item.
  for (const f of fresh) {
    if (takenFingerprints.has(f.fingerprint)) continue
    // Same source, still only suggested, similar title, different day: the date moved.
    const moved = existing.find(
      (r) =>
        isOwn(r) &&
        r.status === 'suggested' &&
        !claimed.has(r.id) &&
        !kept(r) &&
        r.course_id === f.course_id &&
        titleSimilarity(r.title, f.title) >= SAME_SOURCE_SIMILARITY &&
        !numbersDiffer(r.title, f.title)
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

  const remove = existing.filter((r) => isOwn(r) && r.status === 'suggested' && !claimed.has(r.id) && !kept(r)).map((r) => r.id)
  return { insert, update, remove }
}
