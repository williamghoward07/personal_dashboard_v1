import { describe, expect, it } from 'vitest'
import { defaultScrollMinutes, minutesSinceLondonMidnight } from './grid-math'

describe('minutesSinceLondonMidnight', () => {
  it('reads a UTC morning instant during GMT (winter)', () => {
    // 2026-01-15T09:30:00Z is 09:30 London time in January (GMT, no DST).
    expect(minutesSinceLondonMidnight('2026-01-15T09:30:00Z')).toBe(9 * 60 + 30)
  })

  it('reads a UTC instant during BST (summer), one hour ahead', () => {
    // 2026-07-15T09:30:00Z is 10:30 London time in July (BST).
    expect(minutesSinceLondonMidnight('2026-07-15T09:30:00Z')).toBe(10 * 60 + 30)
  })

  it('clamps to the end of the day rather than overflowing', () => {
    expect(minutesSinceLondonMidnight('2026-01-15T23:59:00Z')).toBeLessThanOrEqual(24 * 60)
  })
})

describe('defaultScrollMinutes', () => {
  it('opens a non-today column at a fixed start-of-day hour', () => {
    expect(defaultScrollMinutes(false, 12 * 60)).toBe(7 * 60)
  })

  it("opens today's column with a lead-in before the current time", () => {
    expect(defaultScrollMinutes(true, 10 * 60)).toBe(10 * 60 - 90)
  })

  it('never scrolls above the top of the grid', () => {
    expect(defaultScrollMinutes(true, 30)).toBe(0)
  })
})
