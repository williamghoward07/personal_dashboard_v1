import { describe, expect, it } from 'vitest'
import { defaultWeek, groupByWeek, readingProgress, splitReadings, weekOptions } from './readings'

const r = (id: string, week: number | null, position = 0, completed_at: string | null = null) => ({
  id,
  week,
  position,
  completed_at,
})

describe('splitReadings', () => {
  it('separates week-tagged links from sources', () => {
    const { sources, readings } = splitReadings([r('a', null), r('b', 2), r('c', null)])
    expect(sources.map((l) => l.id)).toEqual(['a', 'c'])
    expect(readings.map((l) => l.id)).toEqual(['b'])
  })
})

describe('readingProgress', () => {
  it('counts done readings', () => {
    expect(readingProgress([r('a', 1, 0, 'x'), r('b', 1), r('c', 2, 0, 'y')])).toEqual({
      done: 2,
      total: 3,
      percent: 67,
    })
  })
  it('is 0% with nothing', () => {
    expect(readingProgress([])).toEqual({ done: 0, total: 0, percent: 0 })
  })
})

describe('groupByWeek', () => {
  it('groups ascending by week, ordered by position, with per-week progress', () => {
    const groups = groupByWeek([r('w3', 3), r('w1b', 1, 2, 'x'), r('w1a', 1, 1), r('src', null)])
    expect(groups.map((g) => g.week)).toEqual([1, 3])
    expect(groups[0].links.map((l) => l.id)).toEqual(['w1a', 'w1b'])
    expect(groups[0].progress).toEqual({ done: 1, total: 2, percent: 50 })
  })
})

describe('defaultWeek / weekOptions', () => {
  it('defaults to the latest week, or week 1', () => {
    expect(defaultWeek([])).toBe(1)
    expect(defaultWeek([r('a', 4), r('b', 2)])).toBe(4)
  })
  it('offers at least a term of weeks, and one past the latest', () => {
    expect(weekOptions([])).toHaveLength(12)
    expect(weekOptions([r('a', 14)])).toHaveLength(15)
    expect(weekOptions([r('a', 52)])).toHaveLength(52)
  })
})
