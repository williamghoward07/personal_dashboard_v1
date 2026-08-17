interface YMD {
  year: number
  month: number
  day: number
}

export interface LondonDateRange {
  // UTC ISO instants — pass straight through to the Google Calendar API.
  timeMin: string
  timeMax: string
  // Plain 'YYYY-MM-DD' bounds for the same range, for filtering date-only
  // Supabase columns (e.g. tasks.due_date) without a second timezone
  // conversion. endDateKey is exclusive, like timeMax.
  startDateKey: string
  endDateKey: string
}

function londonYMD(date: Date): YMD {
  const londonDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

  const [year, month, day] = londonDate.split('-').map(Number)
  return { year, month, day }
}

function londonOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London',
    timeZoneName: 'shortOffset',
  }).formatToParts(date)

  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const match = tzName.match(/GMT([+-]\d+)/)
  return match ? Number(match[1]) * 60 : 0
}

// Midnight in Europe/London for the given calendar date, as a UTC epoch ms.
// Naive `Date.UTC` on a UTC "midnight" would shift the boundary by an hour
// during BST, so the offset has to be read from Intl for this specific date
// rather than assumed.
function londonMidnightUTC({ year, month, day }: YMD): number {
  const offsetMinutes = londonOffsetMinutes(new Date(Date.UTC(year, month - 1, day)))
  return Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMinutes * 60_000
}

function dateKey({ year, month, day }: YMD): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Anchors on UTC noon (clear of any DST transition) before shifting by whole
// days, then re-derives the London calendar date from the shifted instant.
function addDays(ymd: YMD, delta: number): YMD {
  const anchor = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day, 12) + delta * 86_400_000)
  return londonYMD(anchor)
}

function rangeFromYMD(start: YMD, endExclusive: YMD): LondonDateRange {
  return {
    timeMin: new Date(londonMidnightUTC(start)).toISOString(),
    timeMax: new Date(londonMidnightUTC(endExclusive)).toISOString(),
    startDateKey: dateKey(start),
    endDateKey: dateKey(endExclusive),
  }
}

// Today's (or `now`'s) midnight-to-midnight window in Europe/London local time.
export function londonDayBoundsUTC(now = new Date()): LondonDateRange {
  const ymd = londonYMD(now)
  return rangeFromYMD(ymd, addDays(ymd, 1))
}

// Monday-to-Monday window covering the Europe/London week `now` falls in.
export function londonWeekBoundsUTC(now = new Date()): LondonDateRange {
  const ymd = londonYMD(now)
  const dayOfWeek = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day)).getUTCDay() // 0=Sun..6=Sat
  const monday = addDays(ymd, dayOfWeek === 0 ? -6 : 1 - dayOfWeek)
  return rangeFromYMD(monday, addDays(monday, 7))
}

// 1st-of-month-to-1st-of-next-month window for the given Europe/London
// calendar month (1-indexed), so a whole month view can fetch in one call.
export function londonMonthBoundsUTC(year: number, month: number): LondonDateRange {
  const start: YMD = { year, month, day: 1 }
  const end: YMD = month === 12 ? { year: year + 1, month: 1, day: 1 } : { year, month: month + 1, day: 1 }
  return rangeFromYMD(start, end)
}

// Which Europe/London calendar day a Google event instant (dateTime) or
// all-day date string falls on, as a 'YYYY-MM-DD' key.
export function londonDateKey(value: string): string {
  return dateKey(londonYMD(new Date(value)))
}
