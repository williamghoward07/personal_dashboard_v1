export const MINUTES_PER_DAY = 24 * 60
export const PX_PER_MIN = 1.2
export const GRID_HEIGHT_PX = MINUTES_PER_DAY * PX_PER_MIN
export const GUTTER_PX = 44

export const HOURS = Array.from({ length: 24 }, (_, h) => h)

// Minutes since Europe/London local midnight for a UTC ISO instant —
// clamped to the visible day, so a cross-midnight timed event's start (the
// only part that ever reaches this grid, per the DayItem model) can't push
// a pill above the top or past the bottom of its own column.
export function minutesSinceLondonMidnight(iso: string): number {
  const [h, m] = new Date(iso)
    .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' })
    .split(':')
    .map(Number)
  return Math.min(MINUTES_PER_DAY, Math.max(0, h * 60 + m))
}

export function minutesToPx(minutes: number): number {
  return minutes * PX_PER_MIN
}

// Where to scroll a freshly-mounted grid so it doesn't open at 00:00:
// current time (minus a little lead-in, so "now" isn't glued to the very
// top edge) for today's column, otherwise a fixed sensible start-of-day.
export function defaultScrollMinutes(isToday: boolean, nowMinutes: number): number {
  const DEFAULT_START_HOUR = 7
  const LEAD_IN_MINUTES = 90
  if (!isToday) return DEFAULT_START_HOUR * 60
  return Math.max(0, nowMinutes - LEAD_IN_MINUTES)
}
