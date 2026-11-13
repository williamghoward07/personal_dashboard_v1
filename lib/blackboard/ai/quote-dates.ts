// What a quote really says about dates, so code (not the model) decides
// whether an AI item's due_on / due_time are backed by its own words. Also
// `mentionsDate`, used to find the other sources that might state a deadline
// again. Pure: no server-only, Next or Supabase imports.

import { londonDateKey } from '@/lib/google/london-day'
import { addDays, isDateKey, parseTitleDate, type TitleDate } from '@/lib/blackboard/dates'

// ----------------------------------------------------------- absolute dates --

// "week beginning 9 November", "w/c 9 Nov": the seven days from that date.
const WEEK_OF = /\b(?:week\s+(?:beginning|commencing|starting)|w\/c|w\.c\.)\s+(?:on\s+)?/gi

/**
 * Every calendar date (or range) written in `text`, in order, without
 * duplicates. parseTitleDate only returns the first, so this re-runs it from
 * each word, keeping the word before as context so "Week 12" / "Lecture 3"
 * are still never read as days. "Week beginning <date>" adds that week as a
 * range.
 */
export function datesIn(text: string, ctx: { yearStart: number }): TitleDate[] {
  const out: TitleDate[] = []
  const seen = new Set<string>()
  const add = (d: TitleDate) => {
    const key = `${d.date}|${d.endDate ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(d.endDate ? { date: d.date, endDate: d.endDate } : { date: d.date })
  }
  const starts: number[] = []
  const re = /\S+/g
  for (let m = re.exec(text); m; m = re.exec(text)) starts.push(m.index)
  for (let w = 0; w < starts.length; w++) {
    const found = parseTitleDate(text.slice(starts[Math.max(0, w - 1)]), ctx)
    if (found) add(found)
  }
  for (const m of text.matchAll(WEEK_OF)) {
    const rest = text.slice(m.index + m[0].length)
    const found = parseTitleDate(rest, ctx)
    // Only a date written straight after the phrase.
    if (found && !found.endDate && /^\(?\s*(?:\p{L}+,?\s+)?\d/u.test(rest)) add({ date: found.date, endDate: addDays(found.date, 6) })
  }
  return out
}

/** True when `day` is one of `dates`, or inside one of their ranges. */
export function dateMatches(day: string, dates: TitleDate[]): boolean {
  return dates.some((d) => d.date === day || (d.endDate !== undefined && day >= d.date && day <= d.endDate))
}

// -------------------------------------------------------------------- times --

const TIME_12H = /(?<![\d:.])(\d{1,2})(?:[:.](\d{2}))?\s*([ap])\.?\s?m\b\.?/gi
// A one-digit hour needs a colon: "BLOCK 1.10" is a section number, not 01:10.
const TIME_24H = /(?<![\d.:/])(?:([01]\d|2[0-3])[:.]|(\d):)([0-5]\d)(?![\d.:/])/g
const NOON = /\b(?:12\s*)?(?:noon|midday)\b/i
const MIDNIGHT = /\bmidnight\b/i

function hhmm(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Every clock time written in `text` as 'HH:MM' ("2pm", "14:00", "16.00", "noon", "midnight"). */
export function timesIn(text: string): string[] {
  const out = new Set<string>()
  // Blank numeric dates first so "12.11.2026" can't read as 12:11.
  const plain = text.replace(/\b\d{1,2}([/.-])\d{1,2}\1\d{2,4}\b/g, (s) => ' '.repeat(s.length))
  for (const m of plain.matchAll(TIME_12H)) {
    let h = Number(m[1])
    const min = m[2] ? Number(m[2]) : 0
    if (h < 1 || h > 12 || min > 59) continue
    const pm = m[3].toLowerCase() === 'p'
    if (pm && h !== 12) h += 12
    if (!pm && h === 12) h = 0
    out.add(hhmm(h, min))
  }
  for (const m of plain.matchAll(TIME_24H)) out.add(hhmm(Number(m[1] ?? m[2]), Number(m[3])))
  if (NOON.test(plain)) out.add('12:00')
  if (MIDNIGHT.test(plain)) {
    out.add('00:00')
    out.add('23:59')
  }
  return [...out]
}

// ----------------------------------------------------------- relative dates --

// Full names in any case; the short forms only capitalised ("Fri", "Tues."),
// so the verbs "sat" / "wed" don't count.
const WEEKDAY_FULL = /\b(sun|mon|tues|wednes|thurs|fri|satur)day(?:s|'s|’s)?\b/gi
const WEEKDAY_SHORT = /\b(Sun|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat)\b\.?/g
const SHORT_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 }
const FULL_INDEX: Record<string, number> = { sun: 0, mon: 1, tues: 2, wednes: 3, thurs: 4, fri: 5, satur: 6 }

/** Weekday numbers (0 = Sunday) named in `text`. */
export function weekdaysIn(text: string): number[] {
  const out = new Set<number>()
  for (const m of text.matchAll(WEEKDAY_FULL)) out.add(FULL_INDEX[m[1].toLowerCase()])
  for (const m of text.matchAll(WEEKDAY_SHORT)) out.add(SHORT_INDEX[m[1].toLowerCase()])
  return [...out]
}

export const SESSION_WORDS = '(?:lectures?|tutorials?|seminars?|workshops?|practicals?|sessions?|class(?:es)?|labs?)'
export const SPELLED_WEEK =
  '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)'

const RELATIVE: RegExp[] = [
  /\b(?:today|tonight|tomorrow)\b/i,
  /\b(?:next|this|following|coming)\s+week(?:'s|’s)?\b/i,
  /\bend\s+of\s+(?:the|this|next)\s+week\b/i,
  new RegExp(`\\bnext\\s+${SESSION_WORDS}\\b`, 'i'),
  new RegExp(`\\b(?:before|ahead\\s+of|in\\s+advance\\s+of|in\\s+preparation\\s+for)\\s+(?:the\\s+|your\\s+|our\\s+|this\\s+|next\\s+|each\\s+)?${SESSION_WORDS}\\b`, 'i'),
  new RegExp(`\\bweek\\s*(?:\\d{1,2}|${SPELLED_WEEK})\\b`, 'i'),
]

/** True when `text` names a day only relative to when it was posted ("next week", "Tuesday's tutorial", "week 14"). */
export function hasRelativeSignal(text: string): boolean {
  return weekdaysIn(text).length > 0 || RELATIVE.some((re) => re.test(text))
}

/** How far after its posted day a relative-only quote may point. */
export const RELATIVE_HORIZON_DAYS = 21

/** A source's posted value ('YYYY-MM-DD' or an ISO instant) as its London day, or null. */
export function anchorDay(posted: string | null | undefined): string | null {
  if (!posted) return null
  if (isDateKey(posted)) return posted
  const t = Date.parse(posted)
  return Number.isNaN(t) ? null : londonDateKey(new Date(t).toISOString())
}

function weekdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export type RelativeVerdict = 'ok' | 'no_anchor' | 'date_mismatch'

/**
 * A relative-only quote is believable only for a source with a posted day,
 * when due_on is that day or up to 21 days after it, and falls on the weekday
 * the quote names (if it names any).
 */
export function checkRelative(quote: string, dueOn: string, anchor: string | null): RelativeVerdict {
  if (!anchor) return 'no_anchor'
  if (dueOn < anchor || dueOn > addDays(anchor, RELATIVE_HORIZON_DAYS)) return 'date_mismatch'
  const days = weekdaysIn(quote)
  if (days.length && !days.includes(weekdayOf(dueOn))) return 'date_mismatch'
  return 'ok'
}

// ------------------------------------------------------------ mentionsDate --

const MONTH_NAMES = [
  ['january', 'jan'],
  ['february', 'feb'],
  ['march', 'mar'],
  ['april', 'apr'],
  ['may'],
  ['june', 'jun'],
  ['july', 'jul'],
  ['august', 'aug'],
  ['september', 'sept', 'sep'],
  ['october', 'oct'],
  ['november', 'nov'],
  ['december', 'dec'],
]

/**
 * True when `text` writes the calendar day `dueOn`: the day number with the
 * month name in full or abbreviated (either order, with or without an
 * ordinal suffix or year), or dd/mm[/yyyy] (also with . or -), or ISO. A
 * written year must match. Weekday-only and relative mentions don't count
 * (see mentionsRelatively).
 */
export function mentionsDate(text: string, dueOn: string): boolean {
  if (!text || !isDateKey(dueOn)) return false
  const [y, m, d] = dueOn.split('-').map(Number)
  const month = `(?:${MONTH_NAMES[m - 1].join('|')})`
  const day = `0?${d}`
  const yearOk = (written: string | undefined) => {
    if (!written) return true
    const n = Number(written)
    return (written.length === 2 ? 2000 + n : n) === y
  }
  const patterns = [
    new RegExp(`(?<![\\d.,:/])\\b${day}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${month}\\b\\.?(?:,?\\s+(\\d{4}))?(?!\\d)`, 'gi'),
    new RegExp(`\\b${month}\\.?\\s+${day}(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?(?!\\d)`, 'gi'),
    new RegExp(`(?<![\\w./-])${day}([/.-])0?${m}(?:\\1(\\d{4}|\\d{2}))?(?![\\w/]|[.-]\\d)`, 'g'),
  ]
  for (const re of patterns.slice(0, 2)) {
    for (const match of text.matchAll(re)) if (yearOk(match[1])) return true
  }
  for (const match of text.matchAll(patterns[2])) if (yearOk(match[2])) return true
  return text.includes(dueOn)
}

/** A source with a posted day that could be pointing at `dueOn` in relative words. */
export function mentionsRelatively(text: string, dueOn: string, posted: string | null | undefined): boolean {
  const anchor = anchorDay(posted)
  if (!anchor || !hasRelativeSignal(text)) return false
  return checkRelative(text, dueOn, anchor) === 'ok'
}

