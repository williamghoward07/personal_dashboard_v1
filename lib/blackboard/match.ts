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
import { academicYearStart, addDays, daysBetween, mondayOf, parseTitleDate, type TitleDate } from './dates'
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

/** A date a title associates its item with (deadline dates don't count). */
function sessionDateOf(title: string, yearStart: number): TitleDate | null {
  if (DEADLINE_RE.test(title)) return null
  return parseTitleDate(title, { yearStart })
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

const ORDINAL_RE = /\b(lecture|lect|lec|tutorial|seminar|workshop|practical)s?\s*\.?\s*(\d{1,2}|[ivx]{1,5})\b(?![.\d])/gi
const SHORT_LECTURE_RE = /\bL\s?(\d{1,2})\b(?![.\d])/
const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10 }

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

/** "Lecture 3", "L3", "Workshop I" → { ordinal, type }. */
function ordinalOf(title: string): { ordinal: number; type: string } | null {
  for (const m of title.matchAll(ORDINAL_RE)) {
    const n = /^\d+$/.test(m[2]) ? Number(m[2]) : romanValue(m[2])
    const type = normaliseSessionType(m[1])
    if (n && n > 0 && type) return { ordinal: n, type }
  }
  const short = SHORT_LECTURE_RE.exec(title)
  if (short && Number(short[1]) > 0) return { ordinal: Number(short[1]), type: 'lecture' }
  return null
}

// ------------------------------------------------------ week calibration --

export interface CalibrationContext {
  weekOneStart: string
  yearStart: number
}

function mode(values: number[]): number | null {
  const counts = new Map<number, number>()
  let best: number | null = null
  let bestCount = 0
  for (const v of values) {
    const c = (counts.get(v) ?? 0) + 1
    counts.set(v, c)
    if (c > bestCount) {
      best = v
      bestCount = c
    }
  }
  return best
}

/**
 * The offset that turns ONE course's week labels into university weeks.
 * 1. Titles holding both a week and a date ("Week 2 (12 October)") give
 *    university week(date) − week; the most common value wins.
 * 2. Otherwise, if at least half of the course's distinct labels are ≤ 11,
 *    they're teaching weeks → 11 (no university week ≤ 11 is in term).
 * 3. Otherwise 0 (labels are already university weeks, or there are none).
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

  const labels = new Set(rows.map((r) => r.week_label).filter((w): w is number => typeof w === 'number'))
  if (labels.size === 0) return 0
  const teaching = [...labels].filter((w) => w < FIRST_TEACHING_WEEK).length
  return teaching * 2 >= labels.size ? FIRST_TEACHING_WEEK - 1 : 0
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
  /** Where the strongest signal (date, else week, else ordinal) came from. */
  via: 'own' | 'ancestor' | 'ai' | null
}

/** An ancestor, outermost first. `ai` lets a classified folder pass its week down. */
export interface TargetAncestor {
  title: string
  ai?: BbContentAiLite | null
}

export interface TargetContext {
  yearStart: number
  /** The course's effective week offset. */
  weekOffset: number
}

/**
 * Where one content item points. Trust: a date in its own title → the
 * nearest ancestor title with a date → AI `explicit_date` (own, then
 * nearest ancestor) → a week from its own or an ancestor's label, else AI
 * `uni_week` (+ offset) → an ordinal ("Lecture 3", "L3") from its own or an
 * ancestor's title, else AI `lecture_ordinal`. Session type: the first title
 * (own, then up) naming exactly one type, else AI `session_type`.
 */
export function resolveContentTarget(
  row: Pick<BbContentRecord, 'title' | 'path' | 'week_label'>,
  ancestors: TargetAncestor[],
  ai: BbContentAiLite | null | undefined,
  ctx: TargetContext
): ContentTarget {
  // Nearest first. Path titles fill in ancestors missing from the data.
  const chain: TargetAncestor[] = ancestors.length >= row.path.length ? [...ancestors] : [
    ...row.path.slice(0, row.path.length - ancestors.length).map((title) => ({ title })),
    ...ancestors,
  ]
  const up = chain.reverse()
  const ais = [ai ?? null, ...up.map((a) => a.ai ?? null)]
  const target: ContentTarget = { via: null }

  // Date.
  let date: TitleDate | null = sessionDateOf(row.title, ctx.yearStart)
  let dateVia: ContentTarget['via'] = date ? 'own' : null
  for (let i = 0; !date && i < up.length; i++) {
    date = sessionDateOf(up[i].title, ctx.yearStart)
    if (date) dateVia = 'ancestor'
  }
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
  let ordinal: { ordinal: number; type: string } | null = null
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

// -------------------------------------------------------------- matching --

export type MatchConfidence = 'date' | 'ordinal' | 'week' | 'attached'

export interface MatchedItem {
  content: BbContentLite
  role: BbContentRole
  href: string | null
  label: string
  confidence: MatchConfidence
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
  course: Pick<BbCourseRecord, 'id' | 'week_offset'>
  /** This course's content rows. Removed rows are ignored. */
  contents: BbContentLite[]
  /** AI classification by content id (rows may be missing). */
  ai: Map<string, BbContentAiLite>
  /** Overrides; only those for this session's uid are used. */
  overrides: Pick<BbSessionOverride, 'session_uid' | 'content_id' | 'action'>[]
  keyDates: BbKeyDate[]
  /** Monday of university week 1 ('YYYY-MM-DD'). */
  weekOneStart: string
  /** This session's ordinal among its module's sessions of its type (`sessionOrdinals`). */
  ordinal: number | null
  /** Precomputed effective offset; calibrated from `contents` when absent. */
  weekOffset?: number
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

function linkFor(row: BbContentLite, role: BbContentRole): { href: string | null; label: string } {
  const links = row.links ?? []
  const preferred = ROLE_LINK[role]
  const link = (preferred && links.find((l) => l.kind === preferred)) || links.find((l) => RELEVANT_LINKS.has(l.kind))
  if (link) return { href: link.href, label: link.label?.trim() || row.title }
  return { href: row.url, label: row.title }
}

function covers(target: ContentTarget, day: string): boolean {
  return !!target.date && target.date <= day && day <= (target.endDate ?? target.date)
}

function coversWeek(target: ContentTarget, week: number): boolean {
  return target.uniWeek !== undefined && target.uniWeek <= week && week <= (target.uniWeekEnd ?? target.uniWeek)
}

/** The strongest way `target` matches the session, or null. */
function confidenceFor(
  target: ContentTarget,
  session: { day: string; week: number; type: string | null; ordinal: number | null }
): Exclude<MatchConfidence, 'attached'> | null {
  if (!typeCompatible(target.sessionType, session.type)) return null
  if (covers(target, session.day)) return 'date'
  if (
    target.ordinal !== undefined &&
    session.ordinal !== null &&
    target.ordinal === session.ordinal &&
    target.ordinalType === session.type
  ) {
    return 'ordinal'
  }
  if (coversWeek(target, session.week)) return 'week'
  return null
}

/**
 * What Blackboard holds for one session: slides, readings, recordings,
 * other items, AI key dates and the module reading list. Folders and
 * lessons pass their date/week down and aren't listed themselves (unless
 * one has no children in the data and carries links). AI `admin` rows are
 * left out. `hide` overrides remove an item; `attach` adds one regardless.
 */
export function matchSession(
  session: Pick<TimetableSession, 'uid' | 'start' | 'type'>,
  ctx: MatchContext
): SessionMatch {
  const day = londonDateKey(session.start)
  const contents = ctx.contents.filter((c) => !c.removed_at && c.course_id === ctx.course.id)
  const yearStart = academicYearStart(day)
  const weekOffset =
    ctx.weekOffset ?? effectiveWeekOffset(ctx.course, contents, { weekOneStart: ctx.weekOneStart, yearStart })
  const info = {
    day,
    week: universityWeekOf(day, ctx.weekOneStart),
    type: normaliseSessionType(session.type),
    ordinal: ctx.ordinal,
  }

  const byBbId = new Map(contents.map((c) => [c.bb_id, c]))
  const hasChildren = new Set(contents.map((c) => c.parent_bb_id).filter((id): id is string => !!id))
  const hidden = new Set<string>()
  const attached = new Set<string>()
  for (const o of ctx.overrides) {
    if (o.session_uid !== session.uid) continue
    if (o.action === 'hide') hidden.add(o.content_id)
    else if (o.action === 'attach') attached.add(o.content_id)
  }

  const ancestorsOf = (row: BbContentLite): TargetAncestor[] => {
    const chain: TargetAncestor[] = []
    const seen = new Set<string>([row.bb_id])
    let parentId = row.parent_bb_id
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId)
      const parent = byBbId.get(parentId)
      if (!parent) break
      chain.unshift({ title: parent.title, ai: ctx.ai.get(parent.id) ?? null })
      parentId = parent.parent_bb_id
    }
    return chain
  }

  const matched: (MatchedItem & { order: number })[] = []
  contents.forEach((row, order) => {
    if (hidden.has(row.id)) return
    const ai = ctx.ai.get(row.id)
    const role = resolveRole(row, ai)
    let confidence: MatchConfidence | null = null
    if (attached.has(row.id)) {
      confidence = 'attached'
    } else {
      if (ai?.role === 'admin') return
      const container = row.kind === 'folder' || row.kind === 'lesson'
      if (container && (hasChildren.has(row.bb_id) || (row.links ?? []).length === 0)) return
      const target = resolveContentTarget(row, ancestorsOf(row), ai, { yearStart, weekOffset })
      confidence = confidenceFor(target, info)
    }
    if (!confidence) return
    matched.push({ content: row, role, ...linkFor(row, role), confidence, order })
  })
  matched.sort((a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence] || a.order - b.order)

  const item = (m: MatchedItem): MatchedItem => ({
    content: m.content,
    role: m.role,
    href: m.href,
    label: m.label,
    confidence: m.confidence,
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
    moduleReadingList: moduleReadingList(contents),
    uniWeek: info.week,
    weekOffset,
  }
}

/** The course's top-level item with a Talis link. */
export function moduleReadingList(contents: BbContentLite[]): { href: string; label: string } | null {
  for (const row of contents) {
    if (row.removed_at || row.parent_bb_id || (row.path ?? []).length > 0) continue
    const link = (row.links ?? []).find((l) => l.kind === 'talis')
    if (link) return { href: link.href, label: link.label?.trim() || row.title }
  }
  return null
}
