import { describe, expect, it } from 'vitest'
import { resolveTimedRange } from './timed-range'
import type { TimedDayItem } from './TimeGridPill'

function calendarItem(start: string, end: string | null): TimedDayItem {
  return {
    kind: 'calendar',
    id: 'c1',
    title: 'Test event',
    allDay: false,
    start,
    end,
    spanStartKey: '2026-01-15',
    spanEndKey: '2026-01-15',
  }
}

function routineItem(start: string, durationMinutes: number): TimedDayItem {
  return {
    kind: 'routine',
    id: 'r1',
    title: 'Test routine',
    start,
    durationMinutes,
    colour: '#ffffff',
    routineId: 'routine-1',
    instance: {} as never,
  }
}

describe('resolveTimedRange', () => {
  it('uses the real end time when present', () => {
    const range = resolveTimedRange(calendarItem('2026-01-15T09:30:00Z', '2026-01-15T10:30:00Z'))
    expect(range.startMinutes).toBe(9 * 60 + 30)
    expect(range.endMinutes).toBe(10 * 60 + 30)
  })

  it('falls back to a 30-minute placeholder when end is missing', () => {
    const range = resolveTimedRange(calendarItem('2026-01-15T09:30:00Z', null))
    expect(range.endMinutes - range.startMinutes).toBe(30)
  })

  it('uses durationMinutes for a routine instance', () => {
    const range = resolveTimedRange(routineItem('2026-01-15T09:00:00Z', 45))
    expect(range.startMinutes).toBe(9 * 60)
    expect(range.endMinutes).toBe(9 * 60 + 45)
  })

  it('clamps a cross-midnight end (reads earlier than start) to the bottom of the day', () => {
    // Event genuinely starts 23:50 and ends 00:10 the next calendar day —
    // the end ISO's clock-time alone reads as "earlier" than the start.
    const range = resolveTimedRange(calendarItem('2026-01-15T23:50:00Z', '2026-01-16T00:10:00Z'))
    expect(range.startMinutes).toBe(23 * 60 + 50)
    expect(range.endMinutes).toBe(24 * 60)
    expect(range.endMinutes).toBeGreaterThan(range.startMinutes)
  })

  it('never produces a zero-or-negative duration even for a same-instant end', () => {
    const range = resolveTimedRange(calendarItem('2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'))
    expect(range.endMinutes).toBeGreaterThan(range.startMinutes)
  })
})
