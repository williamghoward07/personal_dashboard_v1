import { describe, expect, it } from 'vitest'
import { computeFreeGaps } from './gaps'

const WINDOW = { startMinutes: 420, endMinutes: 1380 } // 07:00-23:00

describe('computeFreeGaps', () => {
  it('returns the whole window when there is no busy time', () => {
    expect(computeFreeGaps(WINDOW, [])).toEqual([WINDOW])
  })

  it('subtracts a single busy interval', () => {
    const busy = [{ id: '1', title: 'Lecture', startMinutes: 600, endMinutes: 660 }]
    expect(computeFreeGaps(WINDOW, busy)).toEqual([
      { startMinutes: 420, endMinutes: 600 },
      { startMinutes: 660, endMinutes: 1380 },
    ])
  })

  it('merges overlapping and touching busy intervals', () => {
    const busy = [
      { id: '1', title: 'A', startMinutes: 600, endMinutes: 660 },
      { id: '2', title: 'B', startMinutes: 650, endMinutes: 700 }, // overlaps A
      { id: '3', title: 'C', startMinutes: 700, endMinutes: 720 }, // touches B
    ]
    expect(computeFreeGaps(WINDOW, busy)).toEqual([
      { startMinutes: 420, endMinutes: 600 },
      { startMinutes: 720, endMinutes: 1380 },
    ])
  })

  it('clips busy intervals that spill outside the window', () => {
    const busy = [{ id: '1', title: 'Early', startMinutes: 0, endMinutes: 500 }]
    expect(computeFreeGaps(WINDOW, busy)).toEqual([{ startMinutes: 500, endMinutes: 1380 }])
  })

  it('ignores busy intervals entirely outside the window', () => {
    const busy = [{ id: '1', title: 'Midnight snack', startMinutes: 0, endMinutes: 100 }]
    expect(computeFreeGaps(WINDOW, busy)).toEqual([WINDOW])
  })

  it('returns no gaps when the window is fully busy', () => {
    const busy = [{ id: '1', title: 'All day', startMinutes: 0, endMinutes: 2000 }]
    expect(computeFreeGaps(WINDOW, busy)).toEqual([])
  })
})
