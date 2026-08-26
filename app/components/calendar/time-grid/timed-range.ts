import { MINUTES_PER_DAY, minutesSinceLondonMidnight } from './grid-math'
import type { TimedDayItem } from './TimeGridPill'

// The DayItem model doesn't track a Google Calendar event's real duration
// beyond its start (see calendarItems.ts) for anything but the small
// minority of cases where `end` was populated — this placeholder keeps
// those pills a sensible, visible height rather than collapsing to zero.
const DEFAULT_CALENDAR_EVENT_MINUTES = 30
const MIN_EVENT_MINUTES = 15

export interface TimedRange {
  startMinutes: number
  endMinutes: number // always > startMinutes, clamped to the visible day
}

// A timed event crossing London midnight only ever reaches this grid via
// its start-day entry (see calendarItems.ts's DayItem model), so its `end`
// ISO's clock time can read as *earlier* than its start once both are
// reduced to minutes-since-midnight. Rather than wrapping into a negative
// or backwards-looking duration, that case is clamped to run to the bottom
// of the visible day.
export function resolveTimedRange(item: TimedDayItem): TimedRange {
  const start = item.start
  const startMinutes = minutesSinceLondonMidnight(start)

  if (item.kind === 'routine') {
    return { startMinutes, endMinutes: Math.min(MINUTES_PER_DAY, startMinutes + item.durationMinutes) }
  }

  const rawEndMinutes = item.end ? minutesSinceLondonMidnight(item.end) : startMinutes + DEFAULT_CALENDAR_EVENT_MINUTES
  const endMinutes = Math.min(MINUTES_PER_DAY, Math.max(startMinutes + MIN_EVENT_MINUTES, rawEndMinutes))
  return { startMinutes, endMinutes }
}
