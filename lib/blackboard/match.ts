// Lecture ↔ Blackboard matching: which content items belong to one
// timetable session. Pure: no React, Next or Supabase. Never looks at or
// changes prep state — the prep light is lib/timetable/session.ts's job.
//
// The ICS titles carry no topic, so a session is found by what Blackboard
// writes in its titles: a date ("Monday, 9 November:"), a lecture number
// ("Lecture 1 - …"), or a week label. Week labels come in two scales:
// Durham university weeks (week 12 = Mon 5 Oct 2026) and teaching weeks
// (week 1 = the same Monday). `bb_courses.week_offset` turns a course's
// labels into university weeks; `calibrateWeekOffset` guesses it when it's 0.

import { londonDateKey } from '@/lib/google/london-day'
import type { TimetableSession } from '@/lib/timetable/session'
import { academicYearStart, addDays, daysBetween, findTitleDate, mondayOf, type TitleDate, type TitleDateMatch } from './dates'
import { parseWeekLabel } from './normalise'
import type {
  BbContentAi,
  BbContentLink,
  BbContentRecord,
  BbContentRole,
  BbCourseRecord,
  BbKeyDate,
  BbSessionOverride,
} from './types'

// ------------------------------------------------------------- row shapes --

/** The bb_content columns matching reads (never `body_text`). */
export type BbContentLite = Pick<
  BbContentRecord,
  'id' | 'bb_id' | 'course_id' | 'parent_bb_id' | 'title' | 'kind' | 'path' | 'week_label' | 'url' | 'links' | 'removed_at'
>
export const CONTENT_MATCH_COLUMNS = 'id, bb_id, course_id, parent_bb_id, title, kind, path, week_label, url, links, removed_at'

/** The bb_content_ai columns matching reads. */
export type BbContentAiLite = Pick<
  BbContentAi,
  'content_id' | 'role' | 'uni_week' | 'session_type' | 'lecture_ordinal' | 'explicit_date' | 'read_with_ai'
>
export const CONTENT_AI_MATCH_COLUMNS = 'content_id, role, uni_week, session_type, lecture_ordinal, explicit_date, read_with_ai'

// ------------------------------------------------------- university weeks --

/** University week 12 is the first teaching week. */
const FIRST_TEACHING_WEEK = 12
const DAYS_BEFORE_TEACHING = (FIRST_TEACHING_WEEK - 1) * 7 // 77

/**
 * The Monday of university week 1, derived from the timetable: the Monday of
 * the earliest module session, 11 weeks back. Null with no module sessions.
 */
export function defaultWeekOneStart(sessions: Pick<TimetableSession, 'moduleCode' | 'start'>[]): string | null {
  let earliest: string | null = null
  for (const s of sessions) {
    if (!s.moduleCode) continue
    const day = londonDateKey(s.start)
    if (!earliest || day < earliest) earliest = day
  }
  return earliest ? addDays(mondayOf(earliest), -DAYS_BEFORE_TEACHING) : null
}

/** University week number of a London day (week 1 starts on `weekOneStart`). */
export function universityWeekOf(dateKey: string, weekOneStart: string): number {
  return Math.floor(daysBetween(weekOneStart, dateKey) / 7) + 1
}

/** The academic year a university-week calendar serves (week 1 sits in late July). */
export function yearStartForWeekOne(weekOneStart: string): number {
  return academicYearStart(addDays(weekOneStart, 28))
}

// ----------------------------------------------------------- title reading --

/** A title's date is a deadline, not a session, when it says "due …" / "deadline". */
const DEADLINE_RE = /\b(?:due|deadlines?|submit|submission|hand[- ]?in)\b/i

/**
 * A date straight after one of these says when the file changed, not which
 * session it's for: "Lecture 1 Slides-Updated 9 Nov. 2026", "revised: 3/11",
 * "v2 12 October". Anchored at the end of the text before the date.
 */
const CHANGE_DATE_RE =
  /(?:\b(?:updated|revised|amended|posted|uploaded|added|released|as\s+of|version(?:\s*\d+(?:\.\d+)*)?)|\bv\d+(?:\.\d+)*)(?:\s*on)?[\s:\-–—]{0,4}(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s*)?$/i

/** A date a title associates its item with (deadline and "updated" dates don't count), with its span. */
function sessionDateMatch(title: string, yearStart: number): TitleDateMatch | null {
  if (DEADLINE_RE.test(title)) return null
  return findTitleDate(title, { yearStart, skipAfter: CHANGE_DATE_RE })
}

function sessionDateOf(title: string, yearStart: number): TitleDate | null {
  const m = sessionDateMatch(title, yearStart)
  if (!m) return null
  return m.endDate ? { date: m.date, endDate: m.endDate } : { date: m.date }
}

const WEEK_RANGE_RE = /\b(?:weeks?|wks?)\.?\s*(\d{1,2})\s*(?:-|–|—|to|&|and)\s*(?:weeks?\s*)?(\d{1,2})\b/i

/** "Week 12" → [12, 12]; "Weeks 13-15" → [13, 15]. As labelled (not offset). */
function weekLabelOf(title: string): [number, number] | null {
  const range = WEEK_RANGE_RE.exec(title)
  if (range) {
    const a = Number(range[1])
    const b = Number(range[2])
    if (b >= a && b - a <= 10) return [a, b]
  }
  const week = parseWeekLabel(title)
  return week === null ? null : [week, week]
}

const SESSION_WORD_RE =
  /\b(lectures?|tutorials?|seminars?|workshops?|practicals?|fieldwork|field\s?trips?|field\s?class(?:es)?|tests?)\b/gi

/** Timetable or title session type → one comparable word ("Online Workshop" → workshop). */
export function normaliseSessionType(type: string | null | undefined): string | null {
  if (!type) return null
  let t = type.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!t) return null
  t = t.replace(/^online /, '')
  if (/^field ?(?:work|trips?|class(?:es)?)$/.test(t)) return 'fieldwork'
  if (t === 'exam' || t === 'exams') return 'test'
  if (t === 'lect' || t === 'lec') return 'lecture'
  if (/^(?:lecture|tutorial|seminar|workshop|practical|test)s$/.test(t)) return t.slice(0, -1)
  return t
}

/**
 * The session type a title names. `undefined` = it names none; `null` = it
 * names several, so neither it nor its ancestors can say.
 */
function sessionTypeOf(title: string): string | null | undefined {
  const found = new Set<string>()
  for (const m of title.matchAll(SESSION_WORD_RE)) {
    const t = normaliseSessionType(m[1])
    if (t) found.add(t)
  }
  if (found.size === 0) return undefined
  return found.size === 1 ? [...found][0] : null
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
}
const ORDINAL_RE = new RegExp(
  `\\b(lecture|lect|lec|tutorial|seminar|workshop|practical)s?\\s*\\.?\\s*(\\d{1,2}|[ivx]{1,5}|${Object.keys(NUMBER_WORDS).join('|')})\\b(?![.\\d])`,
  'gi'
)
const SHORT_LECTURE_RE = /\bL\s?(\d{1,2})\b(?![.\d])/
const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10 }

/** One word straight before "Lecture 3" that names its series ("Climate Lecture 3"). */
const SERIES_WORD_RE = /(\p{L}{3,})\s+$/u
/** Words that never name a series ("Week 3 Lecture 2", "Online Lecture 2", "Slides Lecture 4"). */
const NOT_A_SERIES_WORD = new Set(
  (
    'the and for with from into this that next last see week weeks block blocks unit units part session sessions ' +
    'slides slide recording recordings recorded notes reading readings online live video panopto encore handout ' +
    'handouts lecture lectures tutorial tutorials seminar seminars workshop workshops practical practicals pre post'
  ).split(' ')
)

function romanValue(s: string): number | null {
  if (!/^[IVX]+$/.test(s)) return null // upper case only: "Lecture in …" is not Lecture I
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]]
    const next = ROMAN[s[i + 1]] ?? 0
    total += v < next ? -v : v
  }
  return total > 0 && total <= 30 ? total : null
}

function numberValue(s: string): number | null {
  if (/^\d+$/.test(s)) return Number(s)
  return NUMBER_WORDS[s.toLowerCase()] ?? romanValue(s)
}

interface TitleOrdinal {
  ordinal: number
  /** Normalised session type the number counts. */
  type: string
  /** The words before the number, normalised: "lecture", "climate lecture", "tutorial". */
  series: string
}

/** "Lecture 3", "L3", "Workshop I", "Tutorial Three", "Climate Lecture 1" → ordinal, type and series. */
function ordinalOf(title: string): TitleOrdinal | null {
  for (const m of title.matchAll(ORDINAL_RE)) {
    const n = numberValue(m[2])
    const type = normaliseSessionType(m[1])
    if (!n || n <= 0 || !type) continue
    const word = SERIES_WORD_RE.exec(title.slice(0, m.index))?.[1]?.toLowerCase()
    const series = word && !NOT_A_SERIES_WORD.has(word) ? `${word} ${type}` : type
    return { ordinal: n, type, series }
  }
  const short = SHORT_LECTURE_RE.exec(title)
  if (short && Number(short[1]) > 0) return { ordinal: Number(short[1]), type: 'lecture', series: 'lecture' }
  return null
}

// ------------------------------------------------------ week calibration --

export interface CalibrationContext {
  weekOneStart: string
  yearStart: number
  /**
   * London days ('YYYY-MM-DD') of the module's timetable sessions, any type.
   * Only used to settle a course whose labels mix both scales.
   */
  sessionDays?: string[]
}

/** The most common value; a tie goes to the smaller absolute value, then the smaller value. Null when empty. */
function mode(values: number[]): number | null {
  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: number | null = null
  let bestCount = 0
  for (const [v, c] of counts) {
    if (
      c > bestCount ||
      (c === bestCount && best !== null && (Math.abs(v) < Math.abs(best) || (Math.abs(v) === Math.abs(best) && v < best)))
    ) {
      best = v
      bestCount = c
    }
  }
  return best
}

/**
 * The offset that turns ONE course's week labels into university weeks.
 * 1. Titles holding both a week and a session date ("Week 2 (12 October)")
 *    give university week(date) − week; the most common value wins.
 * 2. Otherwise, every label ≤ 11 → teaching weeks → 11 (no university week
 *    ≤ 11 is in term).
 * 3. Every label ≥ 12 → already university weeks → 0. No labels → 0.
 * 4. Mixed: offsets 0 and 11 score one point per labelled item that lands
 *    on a university week in which the module has a timetable session; the
 *    higher wins, a tie (or no timetable) → 0.
 */
export function calibrateWeekOffset(rows: Pick<BbContentRecord, 'title' | 'week_label'>[], ctx: CalibrationContext): number {
  const offsets: number[] = []
  for (const row of rows) {
    const week = weekLabelOf(row.title)
    const date = week ? sessionDateOf(row.title, ctx.yearStart) : null
    if (!week || !date) continue
    const offset = universityWeekOf(date.date, ctx.weekOneStart) - week[0]
    if (offset >= 0 && offset < 52) offsets.push(offset)
  }
  const fromDates = mode(offsets)
  if (fromDates !== null) return fromDates

  const labelled = rows.map((r) => r.week_label).filter((w): w is number => typeof w === 'number')
  if (labelled.length === 0) return 0
  const teachingOffset = FIRST_TEACHING_WEEK - 1
  if (labelled.every((w) => w <= teachingOffset)) return teachingOffset
  if (labelled.every((w) => w >= FIRST_TEACHING_WEEK)) return 0

  const sessionWeeks = new Set((ctx.sessionDays ?? []).map((d) => universityWeekOf(d, ctx.weekOneStart)))
  const score = (offset: number) => labelled.filter((w) => sessionWeeks.has(w + offset)).length
  return score(teachingOffset) > score(0) ? teachingOffset : 0
}

/** A non-zero stored `week_offset` wins over calibration. */
export function effectiveWeekOffset(
  course: Pick<BbCourseRecord, 'week_offset'>,
  rows: Pick<BbContentRecord, 'title' | 'week_label'>[],
  ctx: CalibrationContext
): number {
  return course.week_offset ? course.week_offset : calibrateWeekOffset(rows, ctx)
}

// -------------------------------------------------------- content target --

export interface ContentTarget {
  date?: string
  endDate?: string
  /** University week (label + offset). */
  uniWeek?: number
  /** Last university week of a "Weeks 13-15" range. */
  uniWeekEnd?: number
  /** Normalised ("lecture", "tutorial", "workshop" …). */
  sessionType?: string
  ordinal?: number
  /** Normalised type the ordinal counts ("Tutorial 2" → tutorial). */
  ordinalType?: string
  /** The numbered series a title ordinal belongs to ("climate lecture"); unset for an AI ordinal. */
  ordinalSeries?: string
  /** Where the strongest signal (date, else week, else ordinal) came from. */
  via: 'own' | 'ancestor' | 'ai' | null
}

/**
 * An ancestor, outermost first. `ai` lets a classified folder pass its week
 * down; `childDate` is the date its children agree on (`buildCourseIndex`).
 */
export interface TargetAncestor {
  title: string
  ai?: BbContentAiLite | null
  childDate?: TitleDate | null
}

export interface TargetContext {
  yearStart: number
  /** The course's effective week offset. */
  weekOffset: number
}

/** Nearest first. Path titles fill in ancestors missing from the data. */
function nearestFirst(path: string[], ancestors: TargetAncestor[]): TargetAncestor[] {
  const chain: TargetAncestor[] =
    ancestors.length >= path.length
      ? [...ancestors]
      : [...path.slice(0, path.length - ancestors.length).map((title) => ({ title })), ...ancestors]
  return chain.reverse()
}

/** Own title date → own child date → the nearest ancestor's title or child date. No AI. */
function titleDateOf(
  row: { title: string; childDate?: TitleDate | null },
  up: TargetAncestor[],
  yearStart: number
): { date: TitleDate; via: 'own' | 'ancestor' } | null {
  const own = sessionDateOf(row.title, yearStart) ?? row.childDate ?? null
  if (own) return { date: own, via: 'own' }
  for (const a of up) {
    const date = sessionDateOf(a.title, yearStart) ?? a.childDate ?? null
    if (date) return { date, via: 'ancestor' }
  }
  return null
}

/**
 * Where one content item points. Trust: a date in its own title (or the
 * date its children agree on, `childDate`) → the nearest ancestor with one
 * → AI `explicit_date` (own, then nearest ancestor) → a week from its own
 * or an ancestor's label, else AI `uni_week` (+ offset) → an ordinal
 * ("Lecture 3", "L3") from its own or an ancestor's title, else AI
 * `lecture_ordinal`. Session type: the first title (own, then up) naming
 * exactly one type, else AI `session_type`.
 */
export function resolveContentTarget(
  row: Pick<BbContentRecord, 'title' | 'path' | 'week_label'> & { childDate?: TitleDate | null },
  ancestors: TargetAncestor[],
  ai: BbContentAiLite | null | undefined,
  ctx: TargetContext
): ContentTarget {
  const up = nearestFirst(row.path, ancestors)
  const ais = [ai ?? null, ...up.map((a) => a.ai ?? null)]
  const target: ContentTarget = { via: null }

  // Date.
  const fromTitles = titleDateOf(row, up, ctx.yearStart)
  let date: TitleDate | null = fromTitles?.date ?? null
  let dateVia: ContentTarget['via'] = fromTitles?.via ?? null
  if (!date) {
    const explicit = ais.find((a) => a?.explicit_date)?.explicit_date
    if (explicit) {
      date = { date: explicit }
      dateVia = 'ai'
    }
  }
  if (date) {
    target.date = date.date
    if (date.endDate) target.endDate = date.endDate
  }

  // Week.
  let week = weekLabelOf(row.title)
  let weekVia: ContentTarget['via'] = week ? 'own' : null
  for (let i = 0; !week && i < up.length; i++) {
    week = weekLabelOf(up[i].title)
    if (week) weekVia = 'ancestor'
  }
  if (!week && typeof row.week_label === 'number') {
    week = [row.week_label, row.week_label]
    weekVia = 'ancestor'
  }
  if (!week) {
    const aiWeek = ais.find((a) => typeof a?.uni_week === 'number')?.uni_week
    if (typeof aiWeek === 'number') {
      week = [aiWeek, aiWeek]
      weekVia = 'ai'
    }
  }
  if (week) {
    target.uniWeek = week[0] + ctx.weekOffset
    if (week[1] !== week[0]) target.uniWeekEnd = week[1] + ctx.weekOffset
  }

  // Session type.
  for (const title of [row.title, ...up.map((a) => a.title)]) {
    const t = sessionTypeOf(title)
    if (t === undefined) continue
    if (t) target.sessionType = t
    break
  }
  if (!target.sessionType) {
    const aiType = normaliseSessionType(ais.find((a) => a?.session_type)?.session_type)
    if (aiType) target.sessionType = aiType
  }

  // Ordinal.
  let ordinal: { ordinal: number; type: string; series?: string } | null = null
  let ordinalVia: ContentTarget['via'] = null
  for (const [i, title] of [row.title, ...up.map((a) => a.title)].entries()) {
    ordinal = ordinalOf(title)
    if (ordinal) {
      ordinalVia = i === 0 ? 'own' : 'ancestor'
      break
    }
  }
  if (!ordinal) {
    const withOrdinal = ais.find((a) => typeof a?.lecture_ordinal === 'number' && a.lecture_ordinal > 0)
    if (withOrdinal?.lecture_ordinal) {
      ordinal = {
        ordinal: withOrdinal.lecture_ordinal,
        type: normaliseSessionType(withOrdinal.session_type) ?? target.sessionType ?? 'lecture',
      }
      ordinalVia = 'ai'
    }
  }
  if (ordinal) {
    target.ordinal = ordinal.ordinal
    target.ordinalType = ordinal.type
    if (ordinal.series) target.ordinalSeries = ordinal.series
    if (!target.sessionType) target.sessionType = ordinal.type
  }

  target.via = date ? dateVia : week ? weekVia : ordinal ? ordinalVia : null
  return target
}

// ------------------------------------------------------------- ordinals --

/**
 * Per module and per session type, each session's 1-based position in date
 * order, so "Lecture 3" can match the third Lecture. Keyed by uid.
 */
export function sessionOrdinals(sessions: Pick<TimetableSession, 'uid' | 'moduleCode' | 'type' | 'start'>[]): Map<string, number> {
  const groups = new Map<string, Pick<TimetableSession, 'uid' | 'start'>[]>()
  for (const s of sessions) {
    if (!s.moduleCode) continue
    const key = `${s.moduleCode}|${normaliseSessionType(s.type) ?? ''}`
    const list = groups.get(key) ?? []
    list.push(s)
    groups.set(key, list)
  }
  const ordinals = new Map<string, number>()
  for (const list of groups.values()) {
    list
      .sort((a, b) => a.start.localeCompare(b.start) || a.uid.localeCompare(b.uid))
      .forEach((s, i) => ordinals.set(s.uid, i + 1))
  }
  return ordinals
}

// ------------------------------------------------------------ course index --
//
// Everything about a course that doesn't depend on which session is open is
// worked out once per module load (`buildCourseIndex`): each row's target,
// dates folders take from their recordings, numbered series and their
// offsets. `matchSession` then only compares targets with one session.

/** A timetable session as matching reads it. */
export type IndexSession = Pick<TimetableSession, 'uid' | 'start' | 'type'> &
  Partial<Pick<TimetableSession, 'moduleCode' | 'moduleName'>>

export type SessionOverrideLite = Pick<BbSessionOverride, 'session_uid' | 'content_id' | 'action'>

export interface CourseIndexInput {
  /** `name` helps recognise a recording titled "13/10/2026 : Human Geography". */
  course: Pick<BbCourseRecord, 'id' | 'week_offset'> & { name?: string | null }
  /** This course's content rows. Removed rows are ignored. */
  contents: BbContentLite[]
  /** AI classification by content id (rows may be missing). */
  ai: Map<string, BbContentAiLite>
  /** Every override (any session): attached numbered items calibrate their series. */
  overrides: SessionOverrideLite[]
  /** Monday of university week 1 ('YYYY-MM-DD'). */
  weekOneStart: string
  /**
   * This module's timetable sessions, every type. Without them, series
   * calibration, cumulative series and the week-of-a-date fallback are off.
   */
  sessions?: IndexSession[]
  /** Academic year for dates without a year. Default: the one `weekOneStart` serves. */
  yearStart?: number
  /** Precomputed effective week offset; calibrated when absent. */
  weekOffset?: number
}

/** How a numbered series' numbers map onto the module's sessions: position = number + offset. */
export interface SeriesOffset {
  offset: number
  /**
   * attached: from items I attached to a session; dated: from members whose
   * date is a session day; cumulative: counted on from earlier series (a best
   * guess); default: 0 with nothing to go on.
   */
  source: 'attached' | 'dated' | 'cumulative' | 'default'
}

export interface CourseIndexRow {
  content: BbContentLite
  ai: BbContentAiLite | undefined
  role: BbContentRole
  /** Matched automatically at all: not AI admin, not a container listed through its children. */
  auto: boolean
  target: ContentTarget
  /** The session position the ordinal points at (number + series offset). */
  position?: number
  /** The position comes from a cumulative series (no direct evidence). */
  inferred: boolean
  /** University weeks of a date that is no session day of the module, when no week label says otherwise. */
  dateWeek?: [number, number]
}

export interface CourseIndex {
  courseId: string
  weekOneStart: string
  yearStart: number
  weekOffset: number
  /** Live rows, in input order. */
  rows: CourseIndexRow[]
  /** Session uid → position among the module's sessions of its type. */
  ordinals: Map<string, number>
  /** `${type}|${series}` ("lecture|climate lecture") → offset. */
  series: Map<string, SeriesOffset>
  moduleReadingList: { href: string; label: string } | null
}

/** Numeric-aware, case-insensitive, locale-free: "Block 2" < "Block 10". */
function naturalCompare(a: string, b: string): number {
  const ax = a.toLowerCase().match(/\d+|\D+/g) ?? []
  const bx = b.toLowerCase().match(/\d+|\D+/g) ?? []
  for (let i = 0; i < Math.min(ax.length, bx.length); i++) {
    const [x, y] = [ax[i], bx[i]]
    if (x === y) continue
    if (/^\d/.test(x) && /^\d/.test(y)) return Number(x) - Number(y) || x.length - y.length
    return x < y ? -1 : 1
  }
  return ax.length - bx.length
}

function comparePaths(a: string[], b: string[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const c = naturalCompare(a[i], b[i])
    if (c) return c
  }
  return a.length - b.length
}

/** Words a recording title may carry next to its date and still be "just a date". */
const DATE_TITLE_WORDS = new Set(
  (
    'recording recordings recorded lecture lectures lec panopto encore video capture session class live online part pt ' +
    'the and of in at am pm seminar tutorial workshop practical monday tuesday wednesday thursday friday saturday sunday ' +
    'mon tue tues wed thu thur thurs fri sat sun'
  ).split(' ')
)

const WORDS_RE = /[\p{L}\p{N}]+/gu

function nameWordsOf(course: CourseIndexInput['course'], sessions: IndexSession[]): Set<string> {
  const words = new Set<string>()
  const texts = new Set([course.name ?? '', ...sessions.flatMap((s) => [s.moduleName ?? '', s.moduleCode ?? ''])])
  for (const text of texts) for (const w of text.toLowerCase().match(WORDS_RE) ?? []) words.add(w)
  return words
}

/**
 * The date of a title that is essentially just a date: "13/10/2026 : Human
 * Geography" (a Panopto recording named after the module). Anything else
 * next to the date must be the module's name, a weekday, a time or a
 * recording word. Deadline and "updated" dates never count.
 */
function justDateOf(title: string, yearStart: number, nameWords: Set<string>): TitleDate | null {
  const m = sessionDateMatch(title, yearStart)
  if (!m) return null
  const rest = (title.slice(0, m.index) + ' ' + title.slice(m.index + m.length))
    .replace(/\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b/gi, ' ')
    .replace(/\b\d{1,2}[:.]\d{2}\b/g, ' ')
    .toLowerCase()
  const words = rest.match(WORDS_RE) ?? []
  const ok = words.every((w) => DATE_TITLE_WORDS.has(w) || nameWords.has(w) || /^\d{1,2}$/.test(w))
  if (!ok) return null
  return m.endDate ? { date: m.date, endDate: m.endDate } : { date: m.date }
}

interface IndexedSession {
  uid: string
  day: string
  week: number
}

function onDays(list: IndexedSession[], date: TitleDate): IndexedSession[] {
  const end = date.endDate ?? date.date
  return list.filter((s) => s.day >= date.date && s.day <= end)
}

interface SeriesInfo {
  key: string
  type: string
  /** Highest number seen: the slots the series takes up. */
  max: number
  /** Where it sits in the course: the first parent path of its members. */
  path: string[]
  dated: number[]
  attached: number[]
}

/**
 * Per-course precomputation for `matchSession`. Pure and deterministic.
 * - Dates from dated children: a folder or lesson with no date of its own
 *   takes the date its "just a date" children agree on (a Panopto recording
 *   "13/10/2026 : Human Geography"), and its other children inherit it.
 * - Numbered series ("Lecture 3", "Climate Lecture 3", "Tutorial Three"):
 *   members with a date that is a session day, or attached to a session by
 *   hand (which outranks dates), give offset = session position − number;
 *   the most common offset applies to the whole series.
 * - With no evidence and several series of one type (numbering restarting
 *   per block), series are counted on from each other in course order,
 *   after the sessions stand-alone units ("Week 12: Introduction Lecture")
 *   claim. A single series with no evidence keeps offset 0.
 */
export function buildCourseIndex(input: CourseIndexInput): CourseIndex {
  const { weekOneStart } = input
  const yearStart = input.yearStart ?? yearStartForWeekOne(weekOneStart)
  const contents = input.contents.filter((c) => !c.removed_at && c.course_id === input.course.id)
  const sessions = input.sessions ?? []
  const weekOffset =
    input.weekOffset ??
    effectiveWeekOffset(input.course, contents, {
      weekOneStart,
      yearStart,
      sessionDays: sessions.map((s) => londonDateKey(s.start)),
    })

  // Sessions per normalised type in date order (as sessionOrdinals counts them).
  const byType = new Map<string, IndexedSession[]>()
  const typeOfUid = new Map<string, string>()
  const ordinals = new Map<string, number>()
  const allSessions: IndexedSession[] = []
  for (const s of [...sessions].sort((a, b) => a.start.localeCompare(b.start) || a.uid.localeCompare(b.uid))) {
    const type = normaliseSessionType(s.type) ?? ''
    const day = londonDateKey(s.start)
    const entry = { uid: s.uid, day, week: universityWeekOf(day, weekOneStart) }
    const list = byType.get(type) ?? []
    list.push(entry)
    byType.set(type, list)
    typeOfUid.set(s.uid, type)
    ordinals.set(s.uid, list.length)
    allSessions.push(entry)
  }

  const byBbId = new Map(contents.map((c) => [c.bb_id, c]))
  const children = new Map<string, BbContentLite[]>()
  for (const c of contents) {
    if (!c.parent_bb_id) continue
    const list = children.get(c.parent_bb_id) ?? []
    list.push(c)
    children.set(c.parent_bb_id, list)
  }

  // Dates from dated children.
  const nameWords = nameWordsOf(input.course, sessions)
  const childDate = new Map<string, TitleDate>()
  for (const c of contents) {
    if ((c.kind !== 'folder' && c.kind !== 'lesson') || sessionDateOf(c.title, yearStart)) continue
    const dates = (children.get(c.bb_id) ?? [])
      .map((k) => justDateOf(k.title, yearStart, nameWords))
      .filter((d): d is TitleDate => d !== null)
    if (dates.length === 0) continue
    const [first] = dates
    if (dates.every((d) => d.date === first.date && d.endDate === first.endDate)) childDate.set(c.id, first)
  }

  const ancestorsOf = (row: BbContentLite): TargetAncestor[] => {
    const chain: TargetAncestor[] = []
    const seen = new Set<string>([row.bb_id])
    let parentId = row.parent_bb_id
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId)
      const parent = byBbId.get(parentId)
      if (!parent) break
      chain.unshift({ title: parent.title, ai: input.ai.get(parent.id) ?? null, childDate: childDate.get(parent.id) ?? null })
      parentId = parent.parent_bb_id
    }
    return chain
  }

  const entries = contents.map((row) => {
    const ancestors = ancestorsOf(row)
    const ai = input.ai.get(row.id)
    const own = { title: row.title, path: row.path ?? [], week_label: row.week_label, childDate: childDate.get(row.id) ?? null }
    const target = resolveContentTarget(own, ancestors, ai, { yearStart, weekOffset })
    return { row, ai, ancestors, own, target }
  })

  // Numbered series and the evidence for their offsets.
  const seriesKey = (type: string, name: string) => `${type}|${name}`
  const series = new Map<string, SeriesInfo>()
  for (const e of entries) {
    const own = ordinalOf(e.row.title)
    if (!own) continue
    const key = seriesKey(own.type, own.series)
    const info = series.get(key) ?? { key, type: own.type, max: 0, path: e.own.path, dated: [], attached: [] }
    info.max = Math.max(info.max, own.ordinal)
    if (comparePaths(e.own.path, info.path) < 0) info.path = e.own.path
    const date = titleDateOf(e.own, nearestFirst(e.own.path, e.ancestors), yearStart)
    const on = date ? onDays(byType.get(own.type) ?? [], date.date) : []
    if (on.length === 1) info.dated.push((ordinals.get(on[0].uid) ?? 0) - own.ordinal)
    series.set(key, info)
  }
  const entryById = new Map(entries.map((e) => [e.row.id, e]))
  for (const o of input.overrides) {
    if (o.action !== 'attach') continue
    const t = entryById.get(o.content_id)?.target
    if (!t?.ordinalSeries || t.ordinal === undefined || !t.ordinalType) continue
    const position = ordinals.get(o.session_uid)
    if (position === undefined || typeOfUid.get(o.session_uid) !== t.ordinalType) continue
    series.get(seriesKey(t.ordinalType, t.ordinalSeries))?.attached.push(position - t.ordinal)
  }

  const offsets = new Map<string, SeriesOffset>()
  for (const [key, info] of series) {
    const attached = mode(info.attached)
    const dated = mode(info.dated)
    if (attached !== null) offsets.set(key, { offset: attached, source: 'attached' })
    else if (dated !== null) offsets.set(key, { offset: dated, source: 'dated' })
  }

  // Several series of one type with no evidence: count on, in course order.
  const types = new Set([...series.values()].map((s) => s.type))
  for (const type of types) {
    const list = [...series.values()]
      .filter((s) => s.type === type)
      .sort((a, b) => comparePaths(a.path, b.path) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    const timetable = byType.get(type) ?? []
    if (list.length < 2 || timetable.length === 0 || list.every((s) => offsets.has(s.key))) continue

    // Sessions stand-alone units of this type claim by their own date or week.
    const claimed = new Set<number>()
    for (const e of entries) {
      if (e.target.ordinal !== undefined || sessionTypeOf(e.row.title) !== type) continue
      const date = sessionDateOf(e.row.title, yearStart)
      const week = date ? null : weekLabelOf(e.row.title)
      let hit: IndexedSession | undefined
      if (date) {
        const dayWeek = universityWeekOf(date.date, weekOneStart)
        hit = onDays(timetable, date)[0] ?? timetable.find((s) => s.week === dayWeek)
      } else if (week) {
        hit = timetable.find((s) => s.week >= week[0] + weekOffset && s.week <= week[1] + weekOffset)
      }
      if (hit) claimed.add(ordinals.get(hit.uid) ?? 0)
    }

    let cursor = 0
    for (const info of list) {
      const known = offsets.get(info.key)
      if (known) {
        cursor = Math.max(cursor, known.offset + info.max)
        continue
      }
      while (claimed.has(cursor + 1)) cursor++
      offsets.set(info.key, { offset: cursor, source: 'cumulative' })
      cursor += info.max
    }
  }
  for (const key of series.keys()) if (!offsets.has(key)) offsets.set(key, { offset: 0, source: 'default' })

  const rows: CourseIndexRow[] = entries.map(({ row, ai, target }) => {
    const container = row.kind === 'folder' || row.kind === 'lesson'
    const auto = ai?.role !== 'admin' && !(container && (children.has(row.bb_id) || (row.links ?? []).length === 0))
    let position = target.ordinal
    let inferred = false
    if (target.ordinal !== undefined && target.ordinalSeries && target.ordinalType) {
      const s = offsets.get(seriesKey(target.ordinalType, target.ordinalSeries))
      if (s) {
        position = target.ordinal + s.offset
        inferred = s.source === 'cumulative'
      }
    }
    const indexed: CourseIndexRow = { content: row, ai, role: resolveRole(row, ai), auto, target, inferred }
    if (position !== undefined) indexed.position = position
    if (target.date && target.uniWeek === undefined && allSessions.length > 0) {
      const relevant = target.sessionType ? (byType.get(target.sessionType) ?? []) : allSessions
      if (onDays(relevant, { date: target.date, endDate: target.endDate }).length === 0) {
        indexed.dateWeek = [
          universityWeekOf(target.date, weekOneStart),
          universityWeekOf(target.endDate ?? target.date, weekOneStart),
        ]
      }
    }
    return indexed
  })

  return {
    courseId: input.course.id,
    weekOneStart,
    yearStart,
    weekOffset,
    rows,
    ordinals,
    series: offsets,
    moduleReadingList: moduleReadingList(contents),
  }
}

// -------------------------------------------------------------- matching --

export type MatchConfidence = 'date' | 'ordinal' | 'week' | 'attached'

export interface MatchedItem {
  content: BbContentLite
  role: BbContentRole
  href: string | null
  label: string
  confidence: MatchConfidence
  /**
   * Set on an 'ordinal' match counted on from earlier series, with no date
   * or attachment backing it: show it as a best guess.
   */
  inferred?: true
}

export interface SessionMatch {
  slides: MatchedItem[]
  readings: MatchedItem[]
  recordings: MatchedItem[]
  other: MatchedItem[]
  /** Non-dismissed AI key dates for this session (its day, or its week/type). */
  keyDates: BbKeyDate[]
  /** The course's top-level Talis reading list. */
  moduleReadingList: { href: string; label: string } | null
  /** The session's university week. */
  uniWeek: number
  /** The course week offset used. */
  weekOffset: number
}

export interface MatchContext {
  course: CourseIndexInput['course']
  /** This course's content rows. Removed rows are ignored. */
  contents: BbContentLite[]
  /** AI classification by content id (rows may be missing). */
  ai: Map<string, BbContentAiLite>
  /** Overrides; hide/attach apply to this session's uid only. */
  overrides: SessionOverrideLite[]
  keyDates: BbKeyDate[]
  /** Monday of university week 1 ('YYYY-MM-DD'). */
  weekOneStart: string
  /** This session's ordinal among its module's sessions of its type (`sessionOrdinals`). */
  ordinal: number | null
  /** Precomputed effective offset; calibrated from `contents` when absent. */
  weekOffset?: number
  /** This module's timetable sessions (see `CourseIndexInput.sessions`). */
  sessions?: IndexSession[]
  /** `buildCourseIndex` for this course, built once per module load. Rebuilt here when it doesn't fit. */
  index?: CourseIndex
}

const CONFIDENCE_RANK: Record<MatchConfidence, number> = { attached: 0, date: 1, ordinal: 2, week: 3 }

function typeCompatible(itemType: string | null | undefined, sessionType: string | null): boolean {
  const t = normaliseSessionType(itemType)
  return !t || !sessionType || t === sessionType
}

function hasKind(row: BbContentLite, kind: BbContentLink['kind']): boolean {
  return (row.links ?? []).some((l) => l.kind === kind)
}

function resolveRole(row: BbContentLite, ai: BbContentAiLite | undefined): BbContentRole {
  if (hasKind(row, 'slides')) return 'slides'
  if (hasKind(row, 'talis') || ai?.role === 'reading') return 'reading'
  if (hasKind(row, 'panopto') || ai?.role === 'recording') return 'recording'
  return ai?.role ?? 'other'
}

const ROLE_LINK: Partial<Record<BbContentRole, BbContentLink['kind']>> = {
  slides: 'slides',
  reading: 'talis',
  recording: 'panopto',
}
const RELEVANT_LINKS = new Set<BbContentLink['kind']>(['slides', 'talis', 'panopto', 'file'])

const ULTRA_BODY_TITLE_RE = /^ultraDocumentBody$/i

/**
 * What to call a content row. Ultra stores a document page as a parent plus a
 * child literally titled "ultraDocumentBody"; that child shows its parent's
 * title (the last path segment) instead.
 */
export function displayTitle(row: { title: string; path: string[] | null }): string {
  const parent = row.path?.[row.path.length - 1]
  return ULTRA_BODY_TITLE_RE.test(row.title.trim()) && parent ? parent : row.title
}

function linkFor(row: BbContentLite, role: BbContentRole): { href: string | null; label: string } {
  const links = row.links ?? []
  const preferred = ROLE_LINK[role]
  const link = (preferred && links.find((l) => l.kind === preferred)) || links.find((l) => RELEVANT_LINKS.has(l.kind))
  if (link) return { href: link.href, label: link.label?.trim() || displayTitle(row) }
  return { href: row.url, label: displayTitle(row) }
}

function covers(target: ContentTarget, day: string): boolean {
  return !!target.date && target.date <= day && day <= (target.endDate ?? target.date)
}

function coversWeek(target: ContentTarget, week: number): boolean {
  return target.uniWeek !== undefined && target.uniWeek <= week && week <= (target.uniWeekEnd ?? target.uniWeek)
}

/**
 * The strongest way a row matches the session, or null. Trust: date (own,
 * ancestor, children) → ordinal (series offset applied) → week (label, else
 * the week of a date that is no session day of the module).
 */
function confidenceFor(
  row: CourseIndexRow,
  session: { day: string; week: number; type: string | null; ordinal: number | null }
): Exclude<MatchConfidence, 'attached'> | null {
  const { target } = row
  if (!typeCompatible(target.sessionType, session.type)) return null
  if (covers(target, session.day)) return 'date'
  if (
    row.position !== undefined &&
    session.ordinal !== null &&
    row.position === session.ordinal &&
    target.ordinalType === session.type
  ) {
    return 'ordinal'
  }
  if (coversWeek(target, session.week)) return 'week'
  if (row.dateWeek && row.dateWeek[0] <= session.week && session.week <= row.dateWeek[1]) return 'week'
  return null
}

function indexFits(index: CourseIndex | undefined, ctx: MatchContext, yearStart: number): index is CourseIndex {
  return (
    !!index &&
    index.courseId === ctx.course.id &&
    index.weekOneStart === ctx.weekOneStart &&
    index.yearStart === yearStart &&
    (ctx.weekOffset === undefined || ctx.weekOffset === index.weekOffset)
  )
}

/**
 * What Blackboard holds for one session: slides, readings, recordings,
 * other items, AI key dates and the module reading list. Folders and
 * lessons pass their date/week down and aren't listed themselves (unless
 * one has no children in the data and carries links). AI `admin` rows are
 * left out. `hide` overrides remove an item; `attach` adds one regardless.
 * Pure: never reads or changes prep state.
 */
export function matchSession(
  session: Pick<TimetableSession, 'uid' | 'start' | 'type'>,
  ctx: MatchContext
): SessionMatch {
  const day = londonDateKey(session.start)
  const yearStart = academicYearStart(day)
  const index = indexFits(ctx.index, ctx, yearStart)
    ? ctx.index
    : buildCourseIndex({
        course: ctx.course,
        contents: ctx.contents,
        ai: ctx.ai,
        overrides: ctx.overrides,
        weekOneStart: ctx.weekOneStart,
        sessions: ctx.sessions,
        yearStart,
        weekOffset: ctx.weekOffset,
      })
  const weekOffset = index.weekOffset
  const info = {
    day,
    week: universityWeekOf(day, ctx.weekOneStart),
    type: normaliseSessionType(session.type),
    ordinal: ctx.ordinal ?? index.ordinals.get(session.uid) ?? null,
  }

  const hidden = new Set<string>()
  const attached = new Set<string>()
  for (const o of ctx.overrides) {
    if (o.session_uid !== session.uid) continue
    if (o.action === 'hide') hidden.add(o.content_id)
    else if (o.action === 'attach') attached.add(o.content_id)
  }

  const matched: (MatchedItem & { order: number })[] = []
  index.rows.forEach((row, order) => {
    const { content } = row
    if (hidden.has(content.id)) return
    let confidence: MatchConfidence | null = null
    if (attached.has(content.id)) {
      confidence = 'attached'
    } else if (row.auto) {
      confidence = confidenceFor(row, info)
    }
    if (!confidence) return
    matched.push({
      content,
      role: row.role,
      ...linkFor(content, row.role),
      confidence,
      ...(confidence === 'ordinal' && row.inferred ? { inferred: true as const } : {}),
      order,
    })
  })
  matched.sort((a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence] || a.order - b.order)

  const item = (m: MatchedItem): MatchedItem => ({
    content: m.content,
    role: m.role,
    href: m.href,
    label: m.label,
    confidence: m.confidence,
    ...(m.inferred ? { inferred: true as const } : {}),
  })
  const bucket = (keep: (role: BbContentRole) => boolean) => matched.filter((m) => keep(m.role)).map(item)

  const keyDates = ctx.keyDates
    .filter((kd) => kd.course_id === ctx.course.id && kd.status !== 'dismissed')
    .filter((kd) => typeCompatible(kd.for_session_type, info.type))
    .filter((kd) => kd.due_on === day || (typeof kd.for_week === 'number' && kd.for_week + weekOffset === info.week))
    .sort((a, b) => a.due_on.localeCompare(b.due_on) || a.title.localeCompare(b.title))

  return {
    slides: bucket((r) => r === 'slides'),
    readings: bucket((r) => r === 'reading'),
    recordings: bucket((r) => r === 'recording'),
    other: bucket((r) => r !== 'slides' && r !== 'reading' && r !== 'recording'),
    keyDates,
    moduleReadingList: index.moduleReadingList,
    uniWeek: info.week,
    weekOffset,
  }
}

/** The course's top-level item with a Talis link. */
export function moduleReadingList(contents: BbContentLite[]): { href: string; label: string } | null {
  for (const row of contents) {
    if (row.removed_at || row.parent_bb_id || (row.path ?? []).length > 0) continue
    const link = (row.links ?? []).find((l) => l.kind === 'talis')
    if (link) return { href: link.href, label: link.label?.trim() || displayTitle(row) }
  }
  return null
}
