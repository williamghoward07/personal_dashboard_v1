import { describe, expect, it } from 'vitest'
import { entriesThisWeek, formatMinutes, parseMinutesInput, timeSummary, weekRingPercent } from './time'

// Friday 9 Oct 2026, midday in London (BST): the week is Mon 5 – Sun 11 Oct.
const NOW = new Date('2026-10-09T11:00:00Z')

const log = (day: string, minutes: number, created_at = `${day}T10:00:00Z`) => ({ day, minutes, created_at })

describe('formatMinutes', () => {
  it('writes hours and minutes compactly', () => {
    expect(formatMinutes(0)).toBe('0m')
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(105)).toBe('1h 45m')
  })
})

describe('parseMinutesInput', () => {
  it('reads minutes, clock and hour forms', () => {
    expect(parseMinutesInput('50')).toBe(50)
    expect(parseMinutesInput('50m')).toBe(50)
    expect(parseMinutesInput('1:35')).toBe(95)
    expect(parseMinutesInput('1h35')).toBe(95)
    expect(parseMinutesInput('1h 35m')).toBe(95)
    expect(parseMinutesInput('1.5h')).toBe(90)
    expect(parseMinutesInput('2h')).toBe(120)
  })
  it('rejects empty, zero, too long and junk', () => {
    expect(parseMinutesInput('')).toBeNull()
    expect(parseMinutesInput('0')).toBeNull()
    expect(parseMinutesInput('1441')).toBeNull()
    expect(parseMinutesInput('1:75')).toBeNull()
    expect(parseMinutesInput('abc')).toBeNull()
  })
})

describe('timeSummary', () => {
  const logs = [log('2026-10-05', 30), log('2026-10-09', 45), log('2026-10-09', 15), log('2026-10-01', 60), log('2026-09-20', 20)]
  it('splits this week (Mon–Sun, London) from last week and the total', () => {
    expect(timeSummary(logs, NOW)).toEqual({ thisWeek: 90, lastWeek: 60, total: 170, daysThisWeek: 2 })
  })
})

describe('weekRingPercent', () => {
  it('uses the target when set, otherwise last week', () => {
    const s = { thisWeek: 90, lastWeek: 60, total: 0, daysThisWeek: 0 }
    expect(weekRingPercent(s, 180)).toBe(50)
    expect(weekRingPercent(s, null)).toBe(100)
    expect(weekRingPercent({ ...s, thisWeek: 0, lastWeek: 0 }, null)).toBe(0)
  })
})

describe('entriesThisWeek', () => {
  it('keeps this week, newest first', () => {
    const rows = entriesThisWeek(
      [log('2026-10-05', 30), log('2026-10-09', 45, '2026-10-09T08:00:00Z'), log('2026-10-09', 15, '2026-10-09T09:00:00Z'), log('2026-10-01', 60)],
      NOW
    )
    expect(rows.map((r) => r.minutes)).toEqual([15, 45, 30])
  })
})
