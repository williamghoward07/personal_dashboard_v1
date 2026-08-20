import { describe, expect, it } from 'vitest'
import { getDailyVerseIndex } from './daily-verse'

describe('getDailyVerseIndex', () => {
  it('returns 0 for the first day of the year', () => {
    expect(getDailyVerseIndex('2026-01-01', 30)).toBe(0)
  })

  it('cycles back to 0 once the list length is exceeded', () => {
    // Day 31 of the year, 30-entry list: (31-1) % 30 = 0.
    expect(getDailyVerseIndex('2026-01-31', 30)).toBe(0)
  })

  it('is deterministic for the same date and list length', () => {
    expect(getDailyVerseIndex('2026-08-20', 50)).toBe(getDailyVerseIndex('2026-08-20', 50))
  })

  it('advances by one for each subsequent day within a cycle', () => {
    expect(getDailyVerseIndex('2026-03-01', 100)).toBe(getDailyVerseIndex('2026-02-28', 100) + 1)
  })

  it('returns 0 for an empty list rather than dividing by zero', () => {
    expect(getDailyVerseIndex('2026-08-20', 0)).toBe(0)
  })
})
