// Pure time-window handling for Ask. The AI (or the local parser) only ever
// picks one value from TIME_WINDOWS; turning it into real dates is plain
// hand-written code here, in Europe/London calendar days.
import { addDays, dateKey, londonMonthBoundsUTC, londonWeekBoundsUTC, londonYMD, type YMD } from '@/lib/google/london-day'

export const TIME_WINDOWS = [
  'today',
  'yesterday',
  'tomorrow',
  'this_week',
  'last_week',
  'next_week',
  'this_month',
  'last_month',
  'this_year',
  'last_7_days',
  'last_30_days',
  'next_7_days',
] as const

export type TimeWindow = (typeof TIME_WINDOWS)[number]

export interface ResolvedWindow {
  window: TimeWindow
  startDateKey: string
  /** Exclusive. */
  endDateKey: string
  /** e.g. "this month (1–30 Nov 2026)" */
  label: string
}

const PHRASES: { window: TimeWindow; pattern: RegExp }[] = [
  { window: 'last_7_days', pattern: /\b(?:last|past)\s+7\s+days\b|\bpast\s+week\b/i },
  { window: 'last_30_days', pattern: /\b(?:last|past)\s+30\s+days\b|\bpast\s+month\b/i },
  { window: 'next_7_days', pattern: /\bnext\s+7\s+days\b|\bcoming\s+week\b/i },
  { window: 'today', pattern: /\btoday\b|\btonight\b/i },
  { window: 'yesterday', pattern: /\byesterday\b/i },
  { window: 'tomorrow', pattern: /\btomorrow\b/i },
  { window: 'this_week', pattern: /\bthis\s+week\b/i },
  { window: 'last_week', pattern: /\blast\s+week\b/i },
  { window: 'next_week', pattern: /\bnext\s+week\b/i },
  { window: 'this_month', pattern: /\bthis\s+month\b/i },
  { window: 'last_month', pattern: /\blast\s+month\b/i },
  { window: 'this_year', pattern: /\bthis\s+year\b/i },
]

/** Finds the earliest time phrase in the query and returns the query without it. */
export function parseTimeWindow(query: string): { window: TimeWindow | null; rest: string } {
  let best: { window: TimeWindow; index: number; length: number } | null = null
  for (const { window, pattern } of PHRASES) {
    const m = pattern.exec(query)
    if (m && (!best || m.index < best.index)) best = { window, index: m.index, length: m[0].length }
  }
  if (!best) return { window: null, rest: query }
  const rest = `${query.slice(0, best.index)} ${query.slice(best.index + best.length)}`.replace(/\s+/g, ' ').trim()
  return { window: best.window, rest }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function ymdFromKey(key: string): YMD {
  const [year, month, day] = key.split('-').map(Number)
  return { year, month, day }
}

// Inclusive human range from a start key and an exclusive end key.
function rangeText(startKey: string, endExclusiveKey: string): string {
  const s = ymdFromKey(startKey)
  const e = addDays(ymdFromKey(endExclusiveKey), -1)
  if (s.year === e.year && s.month === e.month && s.day === e.day) return `${s.day} ${MONTHS[s.month - 1]} ${s.year}`
  if (s.year === e.year && s.month === e.month) return `${s.day}–${e.day} ${MONTHS[s.month - 1]} ${s.year}`
  if (s.year === e.year) return `${s.day} ${MONTHS[s.month - 1]} – ${e.day} ${MONTHS[e.month - 1]} ${s.year}`
  return `${s.day} ${MONTHS[s.month - 1]} ${s.year} – ${e.day} ${MONTHS[e.month - 1]} ${e.year}`
}

export function resolveTimeWindow(window: TimeWindow, now: Date): ResolvedWindow {
  const today = londonYMD(now)
  let start: string
  let end: string

  switch (window) {
    case 'today':
      start = dateKey(today)
      end = dateKey(addDays(today, 1))
      break
    case 'yesterday':
      start = dateKey(addDays(today, -1))
      end = dateKey(today)
      break
    case 'tomorrow':
      start = dateKey(addDays(today, 1))
      end = dateKey(addDays(today, 2))
      break
    case 'this_week':
    case 'last_week':
    case 'next_week': {
      const week = londonWeekBoundsUTC(now)
      const shift = window === 'last_week' ? -7 : window === 'next_week' ? 7 : 0
      start = dateKey(addDays(ymdFromKey(week.startDateKey), shift))
      end = dateKey(addDays(ymdFromKey(week.endDateKey), shift))
      break
    }
    case 'this_month':
    case 'last_month': {
      const lastMonth = window === 'last_month'
      const month = today.month + (lastMonth ? -1 : 0)
      const year = month < 1 ? today.year - 1 : today.year
      const bounds = londonMonthBoundsUTC(year, month < 1 ? 12 : month)
      start = bounds.startDateKey
      end = bounds.endDateKey
      break
    }
    case 'this_year':
      start = dateKey({ year: today.year, month: 1, day: 1 })
      end = dateKey({ year: today.year + 1, month: 1, day: 1 })
      break
    case 'last_7_days':
      start = dateKey(addDays(today, -6))
      end = dateKey(addDays(today, 1))
      break
    case 'last_30_days':
      start = dateKey(addDays(today, -29))
      end = dateKey(addDays(today, 1))
      break
    case 'next_7_days':
      start = dateKey(today)
      end = dateKey(addDays(today, 7))
      break
  }

  return { window, startDateKey: start, endDateKey: end, label: `${window.replace(/_/g, ' ')} (${rangeText(start, end)})` }
}

/** "Today is Monday 16 November 2026 (2026-11-16), Europe/London." */
export function todayLine(now: Date): string {
  const ymd = londonYMD(now)
  const weekday = WEEKDAYS[new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day)).getUTCDay()]
  return `Today is ${weekday} ${ymd.day} ${MONTHS_LONG[ymd.month - 1]} ${ymd.year} (${dateKey(ymd)}), Europe/London.`
}
