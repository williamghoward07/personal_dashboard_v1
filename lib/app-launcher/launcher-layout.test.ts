import { describe, expect, it } from 'vitest'
import { launcherColumns, launcherHeightForRows, launcherRowsForHeight, stepLauncherSpan } from './launcher-layout'

describe('launcher layout', () => {
  it('fits the available width without cramming desktop columns into a smaller card', () => {
    expect(launcherColumns(1, 240)).toBe(3)
    expect(launcherColumns(1, 340)).toBe(4)
    expect(launcherColumns(1, 1000)).toBe(4)
    expect(launcherColumns(2, 480)).toBe(6)
    expect(launcherColumns(4, 480)).toBe(6)
    expect(launcherColumns(4, 150)).toBe(2)
    expect(launcherColumns(4, 60)).toBe(1)
  })

  it('maps legacy pixel heights to the nearest available row count and round-trips the new sizes', () => {
    expect(launcherRowsForHeight(undefined)).toBe(2)
    expect(launcherRowsForHeight(293)).toBe(2)
    expect(launcherRowsForHeight(294)).toBe(3)
    expect(launcherRowsForHeight(1600)).toBe(12)
    for (const rows of [2, 3, 4, 12]) {
      expect(launcherRowsForHeight(launcherHeightForRows(rows))).toBe(rows)
    }
  })

  it('keeps the saved desktop span when there is no width change at the current breakpoint', () => {
    expect(stepLauncherSpan(4, 0, 2)).toBe(4)
    expect(stepLauncherSpan(4, 1, 2)).toBe(4)
    expect(stepLauncherSpan(4, -1, 2)).toBe(1)
    expect(stepLauncherSpan(1, 1, 2)).toBe(2)
  })
})
