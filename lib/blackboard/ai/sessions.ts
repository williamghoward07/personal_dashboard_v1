// The module's timetable sessions as extraction sees them: which ones a
// prompt lists (a window around each source's posted day) and how grounding
// uses them to check the day of work set for a session. The timetable is
// context only: it is never part of a hash, so a timetable change never
// triggers reprocessing. Pure: no server-only, Next or Supabase imports.

import { londonDateKey } from '@/lib/google/london-day'
import { addDays, daysBetween, isDateKey, mondayOf, type TitleDate } from '@/lib/blackboard/dates'
import { normaliseSessionType } from '@/lib/blackboard/match'
import { SESSION_TYPES, type SessionType } from './common'
import { anchorDay, checkRelative, RELATIVE_HORIZON_DAYS, SESSION_WORDS, weekdayOf, weekdaysIn, type RelativeVerdict } from './quote-dates'

/** One timetable session of the module: its London day and its type in the classifier's vocabulary. */
export interface ModuleSession {
  date: string
  type: SessionType
}

// ------------------------------------------------------------ normalising --

// For a timetable type normaliseSessionType leaves as several words
// ("computer practical", "field trip"). First match wins.
const TYPE_WORDS: [RegExp, SessionType][] = [
  [/\blectures?\b/, 'lecture'],
  [/\btutorials?\b/, 'tutorial'],
  [/\bseminars?\b/, 'seminar'],
  [/\bworkshops?\b/, 'workshop'],
  [/\b(?:practicals?|labs?)\b/, 'practical'],
  [/\bfield ?(?:work|trips?|class(?:es)?)\b/, 'fieldwork'],
  [/\b(?:tests?|exams?)\b/, 'test'],
]

/** A raw timetable type ("Lecture", "Online Workshop", "Computer Practical") → the classifier's vocabulary. */
export function sessionTypeOf(raw: string | null | undefined): SessionType {
  const t = normaliseSessionType(raw)
  if (!t) return 'other'
  if ((SESSION_TYPES as readonly string[]).includes(t)) return t as SessionType
  for (const [re, type] of TYPE_WORDS) if (re.test(t)) return type
  return 'other'
}

const bySession = (a: ModuleSession, b: ModuleSession) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type)

/** `{ date: 'YYYY-MM-DD', type: <raw timetable type> }` rows → sorted, one per day and type; bad dates dropped. */
export function normaliseSessions(rows: { date: string; type: string | null }[]): ModuleSession[] {
  const seen = new Map<string, ModuleSession>()
  for (const r of rows) {
    if (!isDateKey(r.date)) continue
    const s: ModuleSession = { date: r.date, type: sessionTypeOf(r.type) }
    seen.set(`${s.date}|${s.type}`, s)
  }
  return [...seen.values()].sort(bySession)
}

/** The sessions of one module (matched on module code) from the parsed timetable feed. */
export function moduleSessions(
  feed: { moduleCode: string | null; type: string; start: string }[],
  moduleCode: string | null | undefined
): ModuleSession[] {
  const code = moduleCode?.trim().toUpperCase()
  if (!code) return []
  return normaliseSessions(
    feed
      .filter((s) => s.moduleCode?.trim().toUpperCase() === code && !Number.isNaN(Date.parse(s.start)))
      .map((s) => ({ date: londonDateKey(s.start), type: s.type }))
  )
}

// ------------------------------------------------------------ the window --

export const SESSION_DAYS_BEFORE = 7
export const SESSION_DAYS_AFTER = 35
export const MAX_SESSION_LINES = 40

/**
 * The sessions one extraction call lists: for EACH source, the module's
 * sessions from 7 days before to 35 days after its posted day (today when it
 * has none), merged into one list. Sources of a batch are usually posted
 * close together, so the windows overlap and the list stays short. Over 40
 * lines, every source keeps its nearest sessions first (the ones on or after
 * its posted day, then the ones just before), taken in turn.
 */
export function sessionsForBatch(sessions: ModuleSession[], posted: (string | null | undefined)[], today: string): ModuleSession[] {
  if (!sessions.length) return []
  const anchors = [...new Set((posted.length ? posted : [null]).map((p) => anchorDay(p) ?? today))]
  const rank = new Map<ModuleSession, number>()
  for (const a of anchors) {
    const from = addDays(a, -SESSION_DAYS_BEFORE)
    const to = addDays(a, SESSION_DAYS_AFTER)
    const after = sessions.filter((s) => s.date >= a && s.date <= to)
    const before = sessions.filter((s) => s.date >= from && s.date < a).reverse()
    ;[...after, ...before].forEach((s, i) => rank.set(s, Math.min(rank.get(s) ?? Infinity, i)))
  }
  return [...rank]
    .sort((x, y) => x[1] - y[1] || bySession(x[0], y[0]))
    .slice(0, MAX_SESSION_LINES)
    .map(([s]) => s)
    .sort(bySession)
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TYPE_LABEL: Record<SessionType, string> = {
  lecture: 'Lecture',
  tutorial: 'Tutorial',
  practical: 'Practical',
  workshop: 'Workshop',
  seminar: 'Seminar',
  fieldwork: 'Fieldwork',
  test: 'Test',
  other: 'Other session',
}

/** One prompt line: "2026-11-12 Thursday Tutorial". */
export function sessionLine(s: ModuleSession): string {
  return `${s.date} ${WEEKDAYS[weekdayOf(s.date)]} ${TYPE_LABEL[s.type]}`
}

// ------------------------------------------------------------- grounding --

type Kind = SessionType | 'any'

const FIELD_WORDS = /\bfield\s?(?:work|trips?|class(?:es)?)\b/gi
const KIND_WORDS: [RegExp, Kind][] = [
  [/\blectures?\b/i, 'lecture'],
  [/\btutorials?\b/i, 'tutorial'],
  [/\bseminars?\b/i, 'seminar'],
  [/\bworkshops?\b/i, 'workshop'],
  [/\b(?:practicals?|labs?)\b/i, 'practical'],
  [/\b(?:tests?|exams?)\b/i, 'test'],
  // "class" / "session" name no particular kind: any session counts.
  [/\b(?:class(?:es)?|sessions?)\b/i, 'any'],
]

/** The kinds of session a quote names ("before Thursday's tutorial" → tutorial; "next class" → any). */
export function sessionKindsIn(quote: string): Kind[] {
  const out = new Set<Kind>()
  const rest = quote.replace(FIELD_WORDS, ' ')
  if (rest !== quote) out.add('fieldwork')
  for (const [re, kind] of KIND_WORDS) if (re.test(rest)) out.add(kind)
  return [...out]
}

/** Sorted unique days of the sessions of these kinds. */
function daysOf(sessions: ModuleSession[], kinds: Kind[] | null): string[] {
  const any = !kinds || kinds.includes('any')
  return [...new Set(sessions.filter((s) => any || kinds.includes(s.type)).map((s) => s.date))].sort()
}

/** The Monday of the week "next week" / "this week" means, from the posted day; null when the quote says neither (or both). */
function namedWeek(quote: string, anchor: string): string | null {
  const next = /\b(?:next|following)\s+week\b/i.test(quote)
  const current = /\bthis\s+week\b/i.test(quote)
  if (next === current) return null
  return addDays(mondayOf(anchor), next ? 7 : 0)
}

const NEXT_SESSION = new RegExp(`\\bnext\\s+${SESSION_WORDS}`, 'i')

/** Only a written range of at most a week ("week beginning 9 November", "2-6 November") is narrowed to a session day. */
const isWeekRange = (d: TitleDate) => d.endDate !== undefined && daysBetween(d.date, d.endDate) <= 6

/**
 * An absolute date in the quote. A single date: `dueOn` must be it, as
 * before. A range: `dueOn` must lie inside it, and when the quote names a
 * kind of session and the range is at most a week holding sessions of that
 * kind, `dueOn` must be one of those session days. "Week beginning 9
 * November" also reads as the single date 9 November (datesIn); that date
 * is the range's first day, not a date of its own, so it doesn't bypass the
 * range's session days. With no sessions known this is exactly dateMatches.
 */
export function absoluteDateOk(quote: string, dueOn: string, dates: TitleDate[], sessions: ModuleSession[]): boolean {
  const kinds = sessions.length ? sessionKindsIn(quote) : []
  const kindDays = kinds.length ? daysOf(sessions, kinds) : []
  const sessionDaysIn = (d: TitleDate) =>
    kindDays.length && isWeekRange(d) ? kindDays.filter((day) => day >= d.date && day <= d.endDate!) : []
  const narrowed = dates.filter((d) => sessionDaysIn(d).length > 0)
  return dates.some((d) => {
    if (d.endDate === undefined) return d.date === dueOn && !narrowed.some((r) => r.date === d.date)
    if (dueOn < d.date || dueOn > d.endDate) return false
    const days = sessionDaysIn(d)
    return days.length === 0 || days.includes(dueOn)
  })
}

/**
 * A relative-only quote ("next week", "before the tutorial"), with the
 * module's sessions. Always needs a posted day. With no sessions known this
 * is exactly checkRelative.
 *
 * - The quote names a kind of session the list has: the session days of that
 *   kind that the quote can mean are the next one after the posted day ("the
 *   next tutorial"), or those in the week it names ("next week", "this
 *   week"), or else those 0-21 days on; each must be on or after the posted
 *   day, on the weekday the quote names (if any), and within 21 days unless
 *   it is the next session of that kind. When there is such a day, `dueOn`
 *   must be one of them; when there is none, checkRelative decides.
 * - Otherwise checkRelative decides, and a quote naming no weekday may also
 *   point at the module's next session day after the posted day.
 */
export function checkRelativeWithSessions(quote: string, dueOn: string, anchor: string | null, sessions: ModuleSession[]): RelativeVerdict {
  const base = checkRelative(quote, dueOn, anchor)
  if (!anchor || !sessions.length) return base
  const weekdays = weekdaysIn(quote)
  const kinds = sessionKindsIn(quote)
  const kindDays = kinds.length ? daysOf(sessions, kinds) : []

  if (kindDays.length) {
    const next = kindDays.find((d) => d > anchor)
    const horizon = addDays(anchor, RELATIVE_HORIZON_DAYS)
    const possible = (d: string) =>
      d >= anchor && (!weekdays.length || weekdays.includes(weekdayOf(d))) && (d <= horizon || d === next)
    let pool = kindDays
    if (NEXT_SESSION.test(quote)) pool = next ? [next] : []
    else {
      const week = namedWeek(quote, anchor)
      if (week) pool = kindDays.filter((d) => d >= week && d <= addDays(week, 6))
    }
    const candidates = pool.filter(possible)
    if (candidates.length) return candidates.includes(dueOn) ? 'ok' : 'date_mismatch'
    return base
  }

  if (base === 'ok' || kinds.length || weekdays.length) return base
  return dueOn === daysOf(sessions, null).find((d) => d > anchor) ? 'ok' : base
}
