// Calendar dates written in Blackboard titles ("Monday, 9 November:",
// "Summative Essay due 16th February 2027 by 2pm", "2-6 November: …") and
// small date-key helpers. Pure: no React, Next or Supabase.
//
// Every date here is a Europe/London calendar day as a 'YYYY-MM-DD' key.
// Date keys are plain calendar dates, so whole-day arithmetic on them is done
// in UTC (no timezone can shift a calendar date); anything that starts from
// an instant goes through lib/google/london-day.ts.

import { londonDateKey, londonWeekBoundsUTC } from '@/lib/google/london-day'

export interface TitleDate {
  /** 'YYYY-MM-DD' */
  date: string
  /** Last day of a range ("2-6 November"), inclusive. */
  endDate?: string
  /** 'HH:MM', 24-hour, London wall clock. The start of a time range. */
  time?: string
}

// ------------------------------------------------------------ date keys --

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function keyParts(dateKey: string): [number, number, number] {
  const m = KEY_RE.exec(dateKey)
  if (!m) throw new Error(`Not a date key: ${dateKey}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function toKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function utcDay(dateKey: string): number {
  const [y, m, d] = keyParts(dateKey)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/** True for a real 'YYYY-MM-DD' calendar date (no 31 April, no 29 Feb 2027). */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !KEY_RE.test(value)) return false
  const [y, m, d] = keyParts(value)
  return validDate(y, m, d)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function validDate(year: number, month: number, day: number): boolean {
  return year >= 1990 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

/** `dateKey` shifted by `n` calendar days. */
export function addDays(dateKey: string, n: number): string {
  const t = new Date((utcDay(dateKey) + n) * 86_400_000)
  return toKey(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round(utcDay(to) - utcDay(from))
}

/** The Monday of the week `dateKey` falls in. */
export function mondayOf(dateKey: string): string {
  // Noon UTC is the same calendar day in London all year round.
  return londonWeekBoundsUTC(new Date(`${dateKey}T12:00:00Z`)).startDateKey
}

/** Today's London calendar day. */
export function londonToday(now: Date): string {
  return londonDateKey(now.toISOString())
}

/**
 * The calendar year the academic year containing `date` starts in (Aug–Jul):
 * 12 Nov 2026 → 2026, 16 Feb 2027 → 2026. A Date is read as its London day.
 */
export function academicYearStart(date: string | Date): number {
  const key = typeof date === 'string' ? date : londonToday(date)
  const [y, m] = keyParts(key)
  return m >= 8 ? y : y - 1
}

/** Aug–Dec → yearStart, Jan–Jul → yearStart + 1. */
function yearInAcademicYear(month: number, yearStart: number): number {
  return month >= 8 ? yearStart : yearStart + 1
}

// -------------------------------------------------------- title parsing --

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

function monthNumber(word: string): number | null {
  const w = word.toLowerCase().replace(/\.$/, '')
  return MONTHS[w] ?? MONTHS[w.slice(0, 3)] ?? null
}

const MONTH =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const ORD = '(?:st|nd|rd|th)?'
const DASH = '\\s*[-–—]\\s*'
const YEAR = '(?:,?\\s+(\\d{4}))?(?!\\d)'
// A number straight after one of these words is a week, lecture, block …
// number, never a day of the month ("Week 12", "Lecture 3", "BLOCK 1.2").
// Nor is the tail of a decimal section number ("BLOCK 1.10").
const NOT_A_DAY =
  '(?<!\\d[.,:/])(?<!\\b(?:weeks?|wks?|lectures?|lect|lec|blocks?|sessions?|seminars?|tutorials?|workshops?|practicals?|parts?|units?|topics?|chapters?|rooms?|levels?|no|number|l)\\.?\\s*)'

// "30 November-4 December", "30th Nov – 4th Dec 2026"
const CROSS_MONTH_RANGE = new RegExp(
  `${NOT_A_DAY}\\b(\\d{1,2})${ORD}\\s+(${MONTH})\\.?${YEAR}${DASH}(\\d{1,2})${ORD}\\s+(${MONTH})\\b\\.?${YEAR}`,
  'gi'
)
// "2-6 November", "2nd–6th Nov 2026"
const SAME_MONTH_RANGE = new RegExp(`${NOT_A_DAY}\\b(\\d{1,2})${ORD}${DASH}(\\d{1,2})${ORD}\\s+(${MONTH})\\b\\.?${YEAR}`, 'gi')
// "13 November", "16th February 2027", "Mon 5th Oct 2026", "(5 October)", "9 Nov."
const DAY_MONTH = new RegExp(`${NOT_A_DAY}\\b(\\d{1,2})${ORD}(?:\\s+of)?\\s+(${MONTH})\\b\\.?${YEAR}`, 'gi')
// "November 13", "Nov 13th, 2026" — capitalised month only, so "may 3" in prose is skipped.
const MONTH_DAY = new RegExp(
  `\\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\\.?\\s+(\\d{1,2})${ORD}\\b${YEAR}`,
  'g'
)
// "12/11/2026", "12.11.26" — UK day-first, the same separator twice.
const NUMERIC = /(?<![\w./-])(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})(?![\w/]|[.-]\d)/g
// "2026-11-12"
const ISO = /(?<![\w./-])(\d{4})-(\d{2})-(\d{2})(?![\w/]|[.-]\d)/g

interface Candidate {
  index: number
  length: number
  value: TitleDate
}

function resolveYear(explicit: string | undefined, month: number, yearStart: number): number {
  if (!explicit) return yearInAcademicYear(month, yearStart)
  const n = Number(explicit)
  return explicit.length === 2 ? 2000 + n : n
}

function dayMonth(day: string, month: string, year: string | undefined, yearStart: number): string | null {
  // Lower-case "may" is the verb far more often than the month.
  if (month === 'may') return null
  const m = monthNumber(month)
  const d = Number(day)
  if (!m) return null
  const y = resolveYear(year, m, yearStart)
  return validDate(y, m, d) ? toKey(y, m, d) : null
}

function collect(re: RegExp, text: string, build: (m: RegExpExecArray) => TitleDate | null, out: Candidate[]) {
  re.lastIndex = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const value = build(m)
    if (value) out.push({ index: m.index, length: m[0].length, value })
    if (m[0].length === 0) re.lastIndex++
  }
}

function withRange(date: string | null, endDate: string | null): TitleDate | null {
  if (!date) return null
  if (!endDate) return { date }
  // Backwards isn't a range at all ("1.10 - 5 October"): let the plain dates win.
  if (endDate < date) return null
  // Over a fortnight is a span, not a session week: keep its start.
  if (daysBetween(date, endDate) > 14) return { date }
  return endDate === date ? { date } : { date, endDate }
}

function dateCandidates(text: string, yearStart: number): Candidate[] {
  const out: Candidate[] = []
  collect(
    CROSS_MONTH_RANGE,
    text,
    (m) => {
      const [, d1, m1, y1, d2, m2, y2] = m
      const endMonth = monthNumber(m2)
      const startMonth = monthNumber(m1)
      if (!endMonth || !startMonth) return null
      // A year written only at the end applies to the start too (a Dec → Jan range starts a year earlier).
      let startYear = y1
      if (!startYear && y2) startYear = String(startMonth > endMonth ? Number(y2) - 1 : Number(y2))
      return withRange(dayMonth(d1, m1, startYear, yearStart), dayMonth(d2, m2, y2, yearStart))
    },
    out
  )
  collect(
    SAME_MONTH_RANGE,
    text,
    (m) => {
      const [, d1, d2, month, year] = m
      return withRange(dayMonth(d1, month, year, yearStart), dayMonth(d2, month, year, yearStart))
    },
    out
  )
  collect(
    DAY_MONTH,
    text,
    (m) => {
      const date = dayMonth(m[1], m[2], m[3], yearStart)
      return date ? { date } : null
    },
    out
  )
  collect(
    MONTH_DAY,
    text,
    (m) => {
      if (!monthNumber(m[1]) || !new RegExp(`^${MONTH}$`, 'i').test(m[1])) return null
      const date = dayMonth(m[2], m[1], m[3], yearStart)
      return date ? { date } : null
    },
    out
  )
  collect(
    NUMERIC,
    text,
    (m) => {
      const day = Number(m[1])
      const month = Number(m[3])
      const year = m[4].length === 2 ? 2000 + Number(m[4]) : Number(m[4])
      return validDate(year, month, day) ? { date: toKey(year, month, day) } : null
    },
    out
  )
  collect(
    ISO,
    text,
    (m) => {
      const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
      return validDate(year, month, day) ? { date: toKey(year, month, day) } : null
    },
    out
  )
  return out
}

// "2pm", "10am", "2.30pm", "12 noon", then 24-hour "11:00" / "14.30".
const TIME_12H = /(?<![\d:.])(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i
const TIME_NOON = /\b(?:12\s*)?(?:noon|midday)\b/i
// A one-digit hour needs a colon: "BLOCK 1.10" is a section number, not 01:10.
const TIME_24H = /(?<![\d.:/])(?:([01]\d|2[0-3])[:.]|(\d):)([0-5]\d)(?![\d.:/])/

function hhmm(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseTime(text: string): string | undefined {
  const twelve = TIME_12H.exec(text)
  if (twelve) {
    let h = Number(twelve[1])
    const min = twelve[2] ? Number(twelve[2]) : 0
    if (h >= 1 && h <= 12 && min < 60) {
      if (twelve[3].toLowerCase() === 'pm' && h !== 12) h += 12
      if (twelve[3].toLowerCase() === 'am' && h === 12) h = 0
      return hhmm(h, min)
    }
  }
  if (TIME_NOON.test(text)) return '12:00'
  const day = TIME_24H.exec(text)
  if (day) return hhmm(Number(day[1] ?? day[2]), Number(day[3]))
  return undefined
}

export interface TitleDateContext {
  yearStart: number
  /**
   * A date whose preceding text matches this (anchored with `$`, not global)
   * is skipped, along with anything overlapping it: "Slides-Updated 9 Nov."
   * says when a file changed, not which day it is for.
   */
  skipAfter?: RegExp
}

/** A title date and where it sits in the text. */
export interface TitleDateMatch extends TitleDate {
  index: number
  length: number
}

function blank(text: string, spans: { index: number; length: number }[]): string {
  let out = text
  for (const s of spans) out = out.slice(0, s.index) + ' '.repeat(s.length) + out.slice(s.index + s.length)
  return out
}

/** `parseTitleDate`, plus the matched span. */
export function findTitleDate(text: string, ctx: TitleDateContext): TitleDateMatch | null {
  if (!text) return null
  let candidates = dateCandidates(text, ctx.yearStart)
  let skipped: Candidate[] = []
  if (ctx.skipAfter) {
    const re = ctx.skipAfter
    skipped = candidates.filter((c) => re.test(text.slice(0, c.index)))
    candidates = candidates.filter(
      (c) => !skipped.some((s) => c.index < s.index + s.length && s.index < c.index + c.length)
    )
  }
  if (candidates.length === 0) return null
  // Earliest in the text; at the same position the longest (a range beats its first day).
  candidates.sort((a, b) => a.index - b.index || b.length - a.length)
  const best = candidates[0]
  // Look for a time with the date itself blanked out, so "12.11.2026" can't read as 12:11.
  const time = parseTime(blank(text, [best, ...skipped]))
  return { ...best.value, ...(time ? { time } : {}), index: best.index, length: best.length }
}

/**
 * The first calendar date written in `text`, with a range end and a time
 * when given. A date with no year is placed in the academic year starting
 * 1 Aug `ctx.yearStart`. Week, lecture and block numbers are never dates.
 */
export function parseTitleDate(text: string, ctx: TitleDateContext): TitleDate | null {
  const found = findTitleDate(text, ctx)
  if (!found) return null
  const date: TitleDate = { date: found.date }
  if (found.endDate) date.endDate = found.endDate
  if (found.time) date.time = found.time
  return date
}

// ------------------------------------------------------ London wall clock --

const LONDON_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** An instant's Europe/London calendar day and 'HH:MM' wall time. */
function londonWallClock(epochMs: number): { day: string; time: string; wallMs: number } {
  const parts = Object.fromEntries(LONDON_PARTS.formatToParts(new Date(epochMs)).map((p) => [p.type, p.value]))
  const [y, mo, d, h, mi] = [parts.year, parts.month, parts.day, parts.hour, parts.minute].map(Number)
  return { day: toKey(y, mo, d), time: hhmm(h, mi), wallMs: Date.UTC(y, mo - 1, d, h, mi) }
}

/**
 * A Europe/London wall time ('HH:MM') on a London day → UTC ISO instant.
 * The offset is read at the target instant, not at midnight, so clock-change
 * Sundays come out right (same two-pass method as ai/grounding.ts's
 * `toDueAt`, which can't be imported here: it pulls in node:crypto, and this
 * file is bundled for the browser).
 */
export function londonWallTimeToIso(dateKey: string, time: string): string | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!m || !isDateKey(dateKey)) return null
  const [y, mo, d] = keyParts(dateKey)
  const wall = Date.UTC(y, mo - 1, d, Number(m[1]), Number(m[2]))
  const offsetAt = (epochMs: number) => londonWallClock(epochMs).wallMs - Math.floor(epochMs / 60_000) * 60_000
  const guess = wall - offsetAt(Date.UTC(y, mo - 1, d))
  return new Date(wall - offsetAt(guess)).toISOString()
}

/**
 * The `due_at` to store once an item's London day becomes `dueOn`: none
 * stays none; a time already on that day stays; otherwise the same London
 * wall-clock time moved to the new day (moving 11 Nov 14:00 to 26 Nov gives
 * 26 Nov 14:00, never a stale 11 Nov instant).
 */
export function dueAtOnDay(previousDueAt: string | null | undefined, dueOn: string): string | null {
  if (!previousDueAt) return null
  const at = Date.parse(previousDueAt)
  if (Number.isNaN(at)) return null
  const wall = londonWallClock(at)
  if (wall.day === dueOn) return previousDueAt
  return londonWallTimeToIso(dueOn, wall.time)
}
