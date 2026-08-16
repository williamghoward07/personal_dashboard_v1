import { describe, it, expect } from 'vitest'
import { isoWeekday } from './schedule'
import { buildDateGrid, monthLabelsForGrid, type HeatmapCell } from './heatmap'

// Covers a Monday, a mid-week day, and a Sunday — the three cases that
// exercise different "how far back is this week's Monday" offsets.
const REFERENCE_DATES = [
  new Date('2026-08-17T12:00:00Z'), // Monday
  new Date('2026-08-19T12:00:00Z'), // Wednesday
  new Date('2026-08-23T12:00:00Z'), // Sunday
]

describe('buildDateGrid', () => {
  it.each(REFERENCE_DATES)('produces 14 weeks of 7 days each for reference %s', (referenceDate) => {
    const grid = buildDateGrid(referenceDate)
    expect(grid).toHaveLength(14)
    for (const week of grid) {
      expect(week).toHaveLength(7)
    }
  })

  it.each(REFERENCE_DATES)('starts every column on a Monday for reference %s', (referenceDate) => {
    const grid = buildDateGrid(referenceDate)
    for (const week of grid) {
      expect(isoWeekday(week[0].date)).toBe(1)
    }
  })

  it.each(REFERENCE_DATES)('ends every column on a Sunday for reference %s', (referenceDate) => {
    const grid = buildDateGrid(referenceDate)
    for (const week of grid) {
      expect(isoWeekday(week[6].date)).toBe(7)
    }
  })

  it.each(REFERENCE_DATES)('is one contiguous run of dates in row-major order for reference %s', (referenceDate) => {
    const grid = buildDateGrid(referenceDate)
    const flat = grid.flat()
    for (let i = 1; i < flat.length; i++) {
      const prev = new Date(`${flat[i - 1].date}T00:00:00Z`)
      const curr = new Date(`${flat[i].date}T00:00:00Z`)
      expect(curr.getTime() - prev.getTime()).toBe(24 * 60 * 60 * 1000)
    }
  })

  it.each(REFERENCE_DATES)('places the reference date in the final column, not marked future, for reference %s', (referenceDate) => {
    const grid = buildDateGrid(referenceDate)
    const todayKey = referenceDate.toISOString().slice(0, 10)
    const lastColumn = grid[grid.length - 1]
    const todayCell = lastColumn.find((c) => c.date === todayKey)
    expect(todayCell).toBeDefined()
    expect(todayCell?.isFuture).toBe(false)
  })

  it.each(REFERENCE_DATES)('marks every date after the reference date as future, and none before, for reference %s', (referenceDate) => {
    const grid = buildDateGrid(referenceDate)
    const todayKey = referenceDate.toISOString().slice(0, 10)
    for (const cell of grid.flat()) {
      expect(cell.isFuture).toBe(cell.date > todayKey)
    }
  })
})

describe('monthLabelsForGrid', () => {
  function cell(date: string): HeatmapCell {
    return { date, isFuture: false }
  }

  it('always labels the first column', () => {
    const grid: HeatmapCell[][] = [
      [cell('2026-08-03'), cell('2026-08-04'), cell('2026-08-05'), cell('2026-08-06'), cell('2026-08-07'), cell('2026-08-08'), cell('2026-08-09')],
    ]
    expect(monthLabelsForGrid(grid)).toEqual(['Aug'])
  })

  it('labels a column only where the month changes from the previous column', () => {
    const grid: HeatmapCell[][] = [
      [cell('2026-07-27'), cell('2026-07-28'), cell('2026-07-29'), cell('2026-07-30'), cell('2026-07-31'), cell('2026-08-01'), cell('2026-08-02')],
      [cell('2026-08-03'), cell('2026-08-04'), cell('2026-08-05'), cell('2026-08-06'), cell('2026-08-07'), cell('2026-08-08'), cell('2026-08-09')],
      [cell('2026-08-10'), cell('2026-08-11'), cell('2026-08-12'), cell('2026-08-13'), cell('2026-08-14'), cell('2026-08-15'), cell('2026-08-16')],
      [cell('2026-08-31'), cell('2026-09-01'), cell('2026-09-02'), cell('2026-09-03'), cell('2026-09-04'), cell('2026-09-05'), cell('2026-09-06')],
      [cell('2026-09-07'), cell('2026-09-08'), cell('2026-09-09'), cell('2026-09-10'), cell('2026-09-11'), cell('2026-09-12'), cell('2026-09-13')],
    ]
    // Column 0 is labelled Jul (first column, always labelled) even
    // though it ends in August. Column 3 starts on 31 Aug and rolls into
    // September partway through, but stays unlabelled — only each
    // column's first day (the Monday) is checked, not any day later in
    // it — so the real "Sep" label only appears at column 4, whose first
    // day is actually in September.
    expect(monthLabelsForGrid(grid)).toEqual(['Jul', 'Aug', null, null, 'Sep'])
  })
})
