import { describe, expect, it } from 'vitest'
import { londonDayBoundsUTC, londonWeekBoundsUTC } from './london-day'

describe('londonWeekBoundsUTC', () => {
  it('rolls over to a new Monday-Sunday window exactly at the Monday boundary', () => {
    // 2026-08-09 is a Sunday, 2026-08-10 is the following Monday (BST, UTC+1).
    const sunday = londonWeekBoundsUTC(new Date('2026-08-09T20:00:00.000Z'))
    const monday = londonWeekBoundsUTC(new Date('2026-08-10T20:00:00.000Z'))

    expect(sunday.startDateKey).toBe('2026-08-03')
    expect(sunday.endDateKey).toBe('2026-08-10')
    expect(monday.startDateKey).toBe('2026-08-10')
    expect(monday.endDateKey).toBe('2026-08-17')
  })

  it('treats a time just before London midnight on Sunday as still last week', () => {
    // 23:30 BST on Sunday 2026-08-09 is 22:30 UTC — still Sunday in London.
    const lateSunday = londonWeekBoundsUTC(new Date('2026-08-09T22:30:00.000Z'))
    expect(lateSunday.startDateKey).toBe('2026-08-03')
  })

  it('treats a time just after London midnight on Monday as the new week', () => {
    // 00:30 BST on Monday 2026-08-10 is 23:30 UTC the previous day.
    const earlyMonday = londonWeekBoundsUTC(new Date('2026-08-09T23:30:00.000Z'))
    expect(earlyMonday.startDateKey).toBe('2026-08-10')
  })

  it('computes the correct week across the BST -> GMT transition (clocks go back)', () => {
    // 2026-10-25 is the last Sunday of October — UK clocks go back to GMT
    // at 02:00 BST. A date well inside that week should still resolve to
    // the same Monday-Sunday window regardless of the DST shift.
    const beforeTransition = londonWeekBoundsUTC(new Date('2026-10-24T12:00:00.000Z')) // Saturday
    const afterTransition = londonWeekBoundsUTC(new Date('2026-10-26T12:00:00.000Z')) // Monday, now GMT

    expect(beforeTransition.startDateKey).toBe('2026-10-19')
    expect(afterTransition.startDateKey).toBe('2026-10-26')
  })

  it('computes the correct week across the GMT -> BST transition (clocks go forward)', () => {
    // 2026-03-29 is the last Sunday of March — UK clocks go forward to
    // BST at 01:00 GMT.
    const week = londonWeekBoundsUTC(new Date('2026-03-30T12:00:00.000Z')) // Monday, now BST
    expect(week.startDateKey).toBe('2026-03-30')
    expect(week.endDateKey).toBe('2026-04-06')
  })
})

describe('londonDayBoundsUTC', () => {
  it('resolves the correct London calendar day even when UTC has already rolled over', () => {
    // 00:30 UTC on 2026-08-10 is 01:30 BST — same London day, not the 9th.
    const bounds = londonDayBoundsUTC(new Date('2026-08-10T00:30:00.000Z'))
    expect(bounds.startDateKey).toBe('2026-08-10')
  })

  it('resolves the correct London calendar day late at night under GMT', () => {
    // 23:45 GMT on 2026-01-14 is still the 14th in both UTC and London (no offset).
    const bounds = londonDayBoundsUTC(new Date('2026-01-14T23:45:00.000Z'))
    expect(bounds.startDateKey).toBe('2026-01-14')
  })
})
