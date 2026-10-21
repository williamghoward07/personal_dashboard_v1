export const MINUTES_PER_DAY = 24 * 60
export const GUTTER_PX = 44

// Zoom ceiling for the hour grid's vertical density — the floor isn't a
// fixed constant, CalendarPageView derives it from the actual viewport
// height so "fully zoomed out" always exactly fits whatever screen space is
// available, with no scrolling. 240px an hour, for a close look at a busy
// stretch of the day.
export const MAX_PX_PER_MIN = 4

// The zoom the grid opens at (72px an hour): a 30-minute event fits its
// time and a line of title. "Fit day" zooms out to the whole day.
export const DEFAULT_PX_PER_MIN = 1.2

// Zoom in/out buttons multiply or divide by this.
export const ZOOM_STEP = 1.25

// A short event at the zoomed-out floor would otherwise render as a
// near-invisible sliver — every pill stays at least one text line tall
// regardless of zoom, so it's always legible and clickable.
export const MIN_PILL_HEIGHT_PX = 20

// Below this a pill shows time and title on one truncated line; at or
// above it the title gets its own line(s).
export const TWO_LINE_PILL_HEIGHT_PX = 36

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

export function minutesToPx(minutes: number, pxPerMin: number): number {
  return minutes * pxPerMin
}

export function pillHeightPx(startMinutes: number, endMinutes: number, pxPerMin: number): number {
  return Math.max(MIN_PILL_HEIGHT_PX, minutesToPx(endMinutes - startMinutes, pxPerMin))
}

// Where a pill visually ends, in minutes. A short event is drawn taller
// than its duration (MIN_PILL_HEIGHT_PX), so overlap layout has to use this
// rather than the real end, or a 15-minute event and the one right after it
// get stacked on top of each other instead of side by side.
export function visualEndMinutes(startMinutes: number, endMinutes: number, pxPerMin: number): number {
  return startMinutes + pillHeightPx(startMinutes, endMinutes, pxPerMin) / pxPerMin
}

export function gridHeightPx(pxPerMin: number): number {
  return MINUTES_PER_DAY * pxPerMin
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
