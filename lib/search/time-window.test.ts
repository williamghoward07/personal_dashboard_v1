import { describe, expect, it } from 'vitest'
import { TIME_WINDOWS, parseTimeWindow, resolveTimeWindow, todayLine } from './time-window'

describe('parseTimeWindow', () => {
  const cases: [string, string][] = [
    ['spend today', 'today'],
    ['plans tonight', 'today'],
    ['spend yesterday', 'yesterday'],
    ['due tomorrow', 'tomorrow'],
    ['essays this week', 'this_week'],
    ['food last week', 'last_week'],
    ['deadlines next week', 'next_week'],
    ['food this month', 'this_month'],
    ['food last month', 'last_month'],
    ['spend this year', 'this_year'],
    ['spend last 7 days', 'last_7_days'],
    ['spend past 7 days', 'last_7_days'],
    ['spend past week', 'last_7_days'],
    ['spend last 30 days', 'last_30_days'],
    ['spend past month', 'last_30_days'],
    ['due next 7 days', 'next_7_days'],
    ['due coming week', 'next_7_days'],
  ]
  it.each(cases)('%s -> %s', (query, window) => {
    expect(parseTimeWindow(query).window).toBe(window)
  })
  it('is case-insensitive and cleans the rest', () => {
    expect(parseTimeWindow('Food  LAST   Month please')).toEqual({ window: 'last_month', rest: 'Food please' })
    expect(parseTimeWindow('this week')).toEqual({ window: 'this_week', rest: '' })
  })
  it('matches whole words only and returns the first match', () => {
    expect(parseTimeWindow('todayish stuff')).toEqual({ window: null, rest: 'todayish stuff' })
    expect(parseTimeWindow('due tomorrow or today').window).toBe('tomorrow')
  })
  it('no match leaves the query alone', () => {
    expect(parseTimeWindow('geography essay')).toEqual({ window: null, rest: 'geography essay' })
  })
  it('every enum value is resolvable', () => {
    for (const w of TIME_WINDOWS) expect(resolveTimeWindow(w, new Date('2026-11-18T12:00:00Z')).window).toBe(w)
  })
})

describe('resolveTimeWindow', () => {
  const wed = new Date('2026-11-18T12:00:00Z') // Wednesday, GMT

  it('days', () => {
    expect(resolveTimeWindow('today', wed)).toMatchObject({ startDateKey: '2026-11-18', endDateKey: '2026-11-19' })
    expect(resolveTimeWindow('yesterday', wed)).toMatchObject({ startDateKey: '2026-11-17', endDateKey: '2026-11-18' })
    expect(resolveTimeWindow('tomorrow', wed)).toMatchObject({ startDateKey: '2026-11-19', endDateKey: '2026-11-20' })
  })
  it('weeks run Monday to Monday', () => {
    expect(resolveTimeWindow('this_week', wed)).toMatchObject({ startDateKey: '2026-11-16', endDateKey: '2026-11-23' })
    expect(resolveTimeWindow('last_week', wed)).toMatchObject({ startDateKey: '2026-11-09', endDateKey: '2026-11-16' })
    expect(resolveTimeWindow('next_week', wed)).toMatchObject({ startDateKey: '2026-11-23', endDateKey: '2026-11-30' })
    // Sunday belongs to the week that started the Monday before
    expect(resolveTimeWindow('this_week', new Date('2026-11-22T12:00:00Z'))).toMatchObject({ startDateKey: '2026-11-16' })
    // Monday itself starts a week
    expect(resolveTimeWindow('this_week', new Date('2026-11-16T09:00:00Z'))).toMatchObject({ startDateKey: '2026-11-16' })
  })
  it('months, including across a month boundary', () => {
    expect(resolveTimeWindow('this_month', wed)).toMatchObject({ startDateKey: '2026-11-01', endDateKey: '2026-12-01' })
    expect(resolveTimeWindow('last_month', wed)).toMatchObject({ startDateKey: '2026-10-01', endDateKey: '2026-11-01' })
    expect(resolveTimeWindow('last_7_days', new Date('2026-03-03T12:00:00Z'))).toMatchObject({
      startDateKey: '2026-02-25',
      endDateKey: '2026-03-04',
    })
  })
  it('january last_month is December of the previous year', () => {
    expect(resolveTimeWindow('last_month', new Date('2027-01-15T12:00:00Z'))).toMatchObject({
      startDateKey: '2026-12-01',
      endDateKey: '2027-01-01',
    })
  })
  it('year and rolling windows', () => {
    expect(resolveTimeWindow('this_year', wed)).toMatchObject({ startDateKey: '2026-01-01', endDateKey: '2027-01-01' })
    expect(resolveTimeWindow('last_7_days', wed)).toMatchObject({ startDateKey: '2026-11-12', endDateKey: '2026-11-19' })
    expect(resolveTimeWindow('last_30_days', wed)).toMatchObject({ startDateKey: '2026-10-20', endDateKey: '2026-11-19' })
    expect(resolveTimeWindow('next_7_days', wed)).toMatchObject({ startDateKey: '2026-11-18', endDateKey: '2026-11-25' })
  })
  it('uses the London day, not the UTC day, in BST', () => {
    // 23:30 UTC on 14 July is 00:30 on 15 July in London
    const instant = new Date('2026-07-14T23:30:00Z')
    expect(resolveTimeWindow('today', instant)).toMatchObject({ startDateKey: '2026-07-15', endDateKey: '2026-07-16' })
    expect(resolveTimeWindow('this_month', instant)).toMatchObject({ startDateKey: '2026-07-01' })
  })
  it('labels carry the concrete range', () => {
    expect(resolveTimeWindow('this_month', wed).label).toBe('this month (1–30 Nov 2026)')
    expect(resolveTimeWindow('this_week', wed).label).toBe('this week (16–22 Nov 2026)')
    expect(resolveTimeWindow('today', wed).label).toBe('today (18 Nov 2026)')
    expect(resolveTimeWindow('last_7_days', new Date('2026-03-03T12:00:00Z')).label).toBe('last 7 days (25 Feb – 3 Mar 2026)')
    expect(resolveTimeWindow('last_month', new Date('2027-01-15T12:00:00Z')).label).toBe('last month (1–31 Dec 2026)')
    expect(resolveTimeWindow('this_year', wed).label).toBe('this year (1 Jan – 31 Dec 2026)')
  })
})

describe('todayLine', () => {
  it('names the London weekday and date', () => {
    expect(todayLine(new Date('2026-11-16T10:00:00Z'))).toBe('Today is Monday 16 November 2026 (2026-11-16), Europe/London.')
    expect(todayLine(new Date('2026-07-14T23:30:00Z'))).toBe('Today is Wednesday 15 July 2026 (2026-07-15), Europe/London.')
  })
})
