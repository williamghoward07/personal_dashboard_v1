import type { MinuteInterval } from './types'

// Clips busy intervals to window, merges any that overlap or touch, then
// returns the chronologically-sorted complement within window — i.e. the
// free time available for placement. Busy intervals entirely outside
// window are dropped; zero-length gaps are never returned.
export function computeFreeGaps(window: MinuteInterval, busy: MinuteInterval[]): MinuteInterval[] {
  const clipped = busy
    .map((interval) => ({
      startMinutes: Math.max(interval.startMinutes, window.startMinutes),
      endMinutes: Math.min(interval.endMinutes, window.endMinutes),
    }))
    .filter((interval) => interval.startMinutes < interval.endMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes)

  const merged: MinuteInterval[] = []
  for (const interval of clipped) {
    const last = merged[merged.length - 1]
    if (last && interval.startMinutes <= last.endMinutes) {
      last.endMinutes = Math.max(last.endMinutes, interval.endMinutes)
    } else {
      merged.push({ ...interval })
    }
  }

  const gaps: MinuteInterval[] = []
  let cursor = window.startMinutes
  for (const interval of merged) {
    if (interval.startMinutes > cursor) {
      gaps.push({ startMinutes: cursor, endMinutes: interval.startMinutes })
    }
    cursor = Math.max(cursor, interval.endMinutes)
  }
  if (cursor < window.endMinutes) {
    gaps.push({ startMinutes: cursor, endMinutes: window.endMinutes })
  }

  return gaps
}
