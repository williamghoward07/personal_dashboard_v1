import { describe, expect, it } from 'vitest'
import { launcherColumns, launcherHeightForRows, launcherRowsForHeight, stepLauncherSpan } from './launcher-layout'

describe('launcher layout', () => {
  it('fits the available width without cramming desktop columns into a smaller card', () => {
    expect(launcherColumns(1, 240)).toBe(4)
    expect(launcherColumns(2, 480)).toBe(8)
    expect(launcherColumns(4, 480)).toBe(9)
    expect(launcherColumns(4, 150)).toBe(3)
  })

  it('maps legacy pixel heights to the nearest available row count and round-trips the new sizes', () => {
    expect(launcherRowsForHeight(undefined)).toBe(2)
    expect(launcherRowsForHeight(253)).toBe(2)
    expect(launcherRowsForHeight(254)).toBe(3)
    expect(launcherRowsForHeight(900)).toBe(4)
    for (const rows of [2, 3, 4]) {
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
