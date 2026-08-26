export const MINUTES_PER_DAY = 24 * 60
export const GUTTER_PX = 44

// Zoom range for the hour grid's vertical density — MIN is chosen so the
// full 24h grid fits inside MAX_GRID_CONTAINER_PX (see DayGridView/
// WeekGridView) with no scrolling at all, which is the whole point of
// "shrink the view" from the user's side. MAX roughly doubles the default,
// for a closer look at a busy stretch of the day.
export const DEFAULT_PX_PER_MIN = 1.2
export const MIN_PX_PER_MIN = 0.3
export const MAX_PX_PER_MIN = 2.4

// The scroll container never grows past this — at the default/zoomed-in
// end of the range the grid scrolls inside it as before; at the zoomed-out
// end the container shrinks to fit the (now-shorter) grid exactly, so the
// whole day shows with no scrollbar and no dead space below it.
export const MAX_GRID_CONTAINER_PX = 480

// A short event at MIN_PX_PER_MIN would otherwise render as a near-invisible
// sliver (a 15min event is ~4.5px tall there) — every pill stays at least
// this tall regardless of zoom, so it's always legible and clickable.
export const MIN_PILL_HEIGHT_PX = 14

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
