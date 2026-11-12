// Tests and exams for /lectures' Tests tab. Nothing is stored: they're
// picked out of the timetable (a session whose type is a test) and out of
// Google Calendar (an event whose title names one). Pure.

import type { TimetableSession } from './session'

export interface TestEntry {
  /** The timetable UID, or the Google event id prefixed `gcal:`. */
  id: string
  title: string
  moduleCode: string | null
  start: string
  end: string | null
  location: string | null
  allDay: boolean
  source: 'timetable' | 'calendar'
}

// A timetable type is a short label ("Test", "Lecture"…), so it's matched
// whole-word without the exclusions a free-text title needs.
const TEST_TYPE_RE = /\b(e-?tests?|tests?|exams?|examinations?|quiz(zes)?|viva|assessments?)\b/i

// Google titles are free text. Quizzes and "assessment" are left out there:
// "CIS Pub Quiz" and "Critical Assessment of Methodology" (a coursework
// deadline) aren't tests.
const TEST_TITLE_RE = /\b(e-?tests?|tests?|exams?|examinations?|mid-?terms?|viva)\b/i
// About a test rather than one: revision sessions, tips, briefings, feedback.
const NOT_A_TEST_RE = /\b(revision|tips|briefing|feedback|prep(aration)?|results?|induction)\b/i

export function isTimetableTest(session: Pick<TimetableSession, 'type'>): boolean {
  return TEST_TYPE_RE.test(session.type)
}

export function isTestEventTitle(title: string): boolean {
  return TEST_TITLE_RE.test(title) && !NOT_A_TEST_RE.test(title)
}

interface CalendarEventLike {
  id: string
  title: string
  allDay: boolean
  start: string
  end: string | null
}

/**
 * Every test from both sources, in start order. A Google event that starts
 * at the same moment as a timetable test is the same test copied into
 * Google, so only the timetable one (which opens its session page) is kept.
 */
export function collectTests(sessions: TimetableSession[], events: CalendarEventLike[]): TestEntry[] {
  const fromTimetable: TestEntry[] = sessions.filter(isTimetableTest).map((s) => ({
    id: s.uid,
    title: s.moduleName,
    moduleCode: s.moduleCode,
    start: s.start,
    end: s.end,
    location: s.location,
    allDay: false,
    source: 'timetable',
  }))
  const taken = new Set(fromTimetable.map((t) => new Date(t.start).getTime()))
  const fromCalendar: TestEntry[] = events
    .filter((e) => isTestEventTitle(e.title) && !taken.has(new Date(e.start).getTime()))
    .map((e) => ({
      id: `gcal:${e.id}`,
      title: e.title,
      moduleCode: null,
      start: e.start,
      end: e.end,
      location: null,
      allDay: e.allDay,
      source: 'calendar',
    }))
  return [...fromTimetable, ...fromCalendar].sort((a, b) => startMs(a) - startMs(b))
}

// An all-day event's start is a bare date; read it as London midnight-ish
// (noon UTC) so it sorts on the right day either side of BST.
function startMs(test: Pick<TestEntry, 'start' | 'allDay'>): number {
  return new Date(test.allDay ? `${test.start}T12:00:00Z` : test.start).getTime()
}

/** Upcoming = not yet over (soonest first); past = over (most recent first). */
export function splitTests(tests: TestEntry[], now: Date): { upcoming: TestEntry[]; past: TestEntry[] } {
  const upcoming: TestEntry[] = []
  const past: TestEntry[] = []
  for (const test of tests) {
    const endIso = test.end ?? test.start
    const endMs = test.allDay && test.end ? new Date(`${test.end}T00:00:00Z`).getTime() : new Date(endIso).getTime()
    const over = test.allDay && !test.end ? startMs(test) + 12 * 3600_000 < now.getTime() : endMs < now.getTime()
    ;(over ? past : upcoming).push(test)
  }
  return { upcoming, past: past.reverse() }
}

/** Whole London calendar days from `now` to the test's day: 0 = today. */
export function daysUntil(test: Pick<TestEntry, 'start' | 'allDay'>, now: Date): number {
  const key = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const testKey = test.allDay ? test.start.slice(0, 10) : key(new Date(test.start))
  const [ty, tm, td] = testKey.split('-').map(Number)
  const [ny, nm, nd] = key(now).split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(ny, nm - 1, nd)) / 86_400_000)
}

/** "Today" / "Tomorrow" / "In 5 days" / "In 3 weeks" / "In 6 months". */
export function countdownLabel(days: number): string {
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 14) return `In ${days} days`
  if (days < 63) return `In ${Math.round(days / 7)} weeks`
  return `In ${Math.round(days / 30.44)} months`
}
