import { describe, expect, it } from 'vitest'
import type { WorkItem } from '@/lib/blackboard/work'
import { calendarAgendaLayout, prepOverflowCount, pickAgendaDays, priorityLayout, widgetDensity } from './widget-content'

describe('calendarAgendaLayout', () => {
  it('stays at 3 days on a small card, 5+ once taller', () => {
    expect(calendarAgendaLayout({ width: 300, height: 200 }).maxDays).toBe(3)
    expect(calendarAgendaLayout({ width: 300 }).maxDays).toBe(3)
    expect(calendarAgendaLayout({ width: 300, height: 480 }).maxDays).toBeGreaterThanOrEqual(5)
  })
  it('grows with density and height', () => {
    const small = calendarAgendaLayout({ width: 300, height: 200 })
    const wide = calendarAgendaLayout({ width: 800, height: 200 })
    const tall = calendarAgendaLayout({ width: 300, height: 500 })
    expect(wide.maxDays).toBeGreaterThan(small.maxDays)
    expect(tall.maxDays).toBeGreaterThan(small.maxDays)
    expect(calendarAgendaLayout({ width: 900, height: 700 }).maxDays).toBeLessThanOrEqual(10)
    expect(wide.dayLimit).toBeGreaterThan(small.dayLimit)
  })
  it('falls back to span when unmeasured', () => {
    expect(widgetDensity({ span: 1 })).toBe(0)
  })
})

describe('pickAgendaDays', () => {
  const days: [string, string[]][] = [
    ['2026-11-16', []],
    ['2026-11-17', ['a']],
    ['2026-11-19', ['b']],
    ['2026-11-20', []],
    ['2026-11-21', ['c']],
  ]
  it('keeps today, skips empty days, respects the cap', () => {
    expect(pickAgendaDays(days, '2026-11-16', 3).map(([d]) => d)).toEqual(['2026-11-16', '2026-11-17', '2026-11-19'])
  })
  it('adds an empty today when missing', () => {
    expect(pickAgendaDays([['2026-11-18', ['x']]], '2026-11-16', 5)).toEqual([['2026-11-16', []], ['2026-11-18', ['x']]])
  })
})

describe('priorityLayout', () => {
  it('caps a single column', () => {
    const l = priorityLayout({ deadlines: 30, prep: 0 }, { width: 360 })
    expect(l).toMatchObject({ twoColumn: false, deadlines: 5 })
  })
  it('stacks both lists when narrow', () => {
    const l = priorityLayout({ deadlines: 30, prep: 10 }, { width: 360 })
    expect(l).toMatchObject({ twoColumn: false, deadlines: 5, prep: 3 })
  })
  it('balances columns when prep is short', () => {
    const l = priorityLayout({ deadlines: 30, prep: 2 }, { width: 700 })
    expect(l).toMatchObject({ twoColumn: true, prep: 2, deadlines: 4 })
  })
  it('fills both columns when both are long', () => {
    const l = priorityLayout({ deadlines: 30, prep: 30 }, { width: 700 })
    expect(l.deadlines).toBe(l.prep)
  })
})

describe('prepOverflowCount', () => {
  const prep = ['2026-11-17', '2026-11-18', '2026-11-25', '2026-12-30', '2027-01-20'].map((dueOn) => ({ dueOn }) as WorkItem)
  it('counts only unshown prep within 14 days', () => {
    expect(prepOverflowCount(prep, 1, '2026-11-16')).toBe(2)
    expect(prepOverflowCount(prep, 3, '2026-11-16')).toBe(0)
  })
})
