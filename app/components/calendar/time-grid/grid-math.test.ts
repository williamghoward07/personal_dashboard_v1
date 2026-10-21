import { describe, expect, it } from 'vitest'
import {
  MIN_PILL_HEIGHT_PX,
  defaultScrollMinutes,
  minutesSinceLondonMidnight,
  pillHeightPx,
  visualEndMinutes,
} from './grid-math'

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

describe('pill sizing', () => {
  it('keeps a short event at the minimum height', () => {
    expect(pillHeightPx(600, 605, 0.5)).toBe(MIN_PILL_HEIGHT_PX)
  })

  it('uses the real duration once that is taller', () => {
    expect(pillHeightPx(600, 660, 1.2)).toBe(72)
  })

  it('extends a short event to where its pill is drawn', () => {
    // 20px at 0.5px/min is 40 minutes on screen, though the event is 15.
    expect(visualEndMinutes(600, 615, 0.5)).toBe(640)
  })

  it('leaves a long event its real end', () => {
    expect(visualEndMinutes(600, 660, 1.2)).toBe(660)
  })
})
