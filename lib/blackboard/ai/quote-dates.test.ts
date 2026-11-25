import { describe, expect, it } from 'vitest'
import { anchorDay, checkRelative, dateMatches, datesIn, hasRelativeSignal, mentionsDate, mentionsRelatively, timesIn, weekdaysIn } from './quote-dates'

const Y = { yearStart: 2026 }

describe('datesIn', () => {
  it('finds every date in a quote, ranges included', () => {
    expect(datesIn('Summative Essay due 16th February 2027 by 2pm', Y)).toEqual([{ date: '2027-02-16' }])
    expect(datesIn('Posted 10 November: the essay is due 24 November', Y).map((d) => d.date)).toEqual(['2026-11-10', '2026-11-24'])
    expect(datesIn('Presentations 2-6 November', Y)).toContainEqual({ date: '2026-11-02', endDate: '2026-11-06' })
    expect(datesIn('Hand in on 12/11/2026 or 2026-11-13', Y).map((d) => d.date)).toEqual(['2026-11-12', '2026-11-13'])
  })

  it('reads "week beginning <date>" as that week', () => {
    expect(datesIn('Submit your log in the week beginning 9 November', Y)).toContainEqual({ date: '2026-11-09', endDate: '2026-11-15' })
    expect(datesIn('Quiz w/c Monday 16 November', Y)).toContainEqual({ date: '2026-11-16', endDate: '2026-11-22' })
  })

  it('never reads week, lecture or block numbers as days', () => {
    expect(datesIn('Week 12 tutorial on the Lecture 3 reading', Y)).toEqual([])
    expect(datesIn('Submit via Turnitin', Y)).toEqual([])
  })

  it('matches a day against dates and ranges', () => {
    const dates = datesIn('Presentations 2-6 November', Y)
    expect(dateMatches('2026-11-04', dates)).toBe(true)
    expect(dateMatches('2026-11-07', dates)).toBe(false)
  })
})

describe('timesIn', () => {
  it('reads 12-hour, 24-hour, noon and midnight', () => {
    expect(timesIn('due by 2pm')).toEqual(['14:00'])
    expect(timesIn('due 2.30 p.m. sharp')).toEqual(['14:30'])
    expect(timesIn('by 14:00 or 16.00')).toEqual(['14:00', '16:00'])
    expect(timesIn('by 12 noon')).toEqual(['12:00'])
    expect(timesIn('before midnight')).toEqual(['00:00', '23:59'])
  })

  it('ignores dates, section numbers and bare numbers', () => {
    expect(timesIn('due 12.11.2026')).toEqual([])
    expect(timesIn('BLOCK 1.10 reading')).toEqual([])
    expect(timesIn('Read chapter 3')).toEqual([])
  })
})

describe('relative dates', () => {
  it('spots weekdays and relative phrases, not the verbs "sat" / "wed"', () => {
    expect(weekdaysIn("before Tuesday's tutorial and by Fri.")).toEqual([2, 5])
    expect(weekdaysIn('they sat the exam and wed later')).toEqual([])
    for (const t of ['next week', "Tuesday's seminar", 'by Friday', 'the week 14 tutorial', 'tutorial in week fourteen', 'before the next workshop', 'tomorrow']) {
      expect(hasRelativeSignal(t)).toBe(true)
    }
    expect(hasRelativeSignal('Submit via Turnitin')).toBe(false)
  })

  it('accepts a relative date only 0-21 days after the posted day, on the named weekday', () => {
    const posted = '2026-11-10' // a Tuesday
    expect(checkRelative("Read chapter 2 before Tuesday's tutorial", '2026-11-17', posted)).toBe('ok')
    expect(checkRelative("Read chapter 2 before Tuesday's tutorial", '2026-11-18', posted)).toBe('date_mismatch')
    expect(checkRelative('Read chapter 2 for next week', '2026-12-02', posted)).toBe('date_mismatch') // 22 days
    expect(checkRelative('Read chapter 2 for next week', '2026-12-01', posted)).toBe('ok') // 21 days
    expect(checkRelative('Read chapter 2 for next week', '2026-11-09', posted)).toBe('date_mismatch') // before
    expect(checkRelative('Read chapter 2 for next week', '2026-11-17', null)).toBe('no_anchor')
  })

  it('takes the posted day in London', () => {
    expect(anchorDay('2026-11-10')).toBe('2026-11-10')
    expect(anchorDay('2026-06-09T23:30:00Z')).toBe('2026-06-10') // BST
    expect(anchorDay(null)).toBeNull()
    expect(anchorDay('junk')).toBeNull()
  })
})

describe('mentionsDate', () => {
  it.each([
    'The essay is due 24 November.',
    'Due 24th Nov 2026',
    'due on the 24th of November',
    'November 24th, 2026',
    'Nov. 24',
    'Deadline 24/11 at noon',
    'Deadline 24/11/2026',
    'Deadline 24.11.26',
    'Deadline 2026-11-24',
  ])('finds 2026-11-24 in: %s', (text) => {
    expect(mentionsDate(text, '2026-11-24')).toBe(true)
  })

  it.each(['Due 14 November', 'Due 24 October', 'Due 24 November 2027', 'Due 124/11', 'Read 2.24 November', 'Tuesday 24'])('not in: %s', (text) => {
    expect(mentionsDate(text, '2026-11-24')).toBe(false)
  })

  it('finds a relative mention only in a source with a posted day', () => {
    const text = "Please read chapter 2 before Tuesday's tutorial."
    expect(mentionsRelatively(text, '2026-11-17', '2026-11-10T09:00:00Z')).toBe(true)
    expect(mentionsRelatively(text, '2026-11-18', '2026-11-10T09:00:00Z')).toBe(false)
    expect(mentionsRelatively(text, '2026-11-17', null)).toBe(false)
  })
})
