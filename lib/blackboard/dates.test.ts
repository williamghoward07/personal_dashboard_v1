import { describe, expect, it } from 'vitest'
import { academicYearStart, addDays, daysBetween, isDateKey, londonToday, mondayOf, parseTitleDate } from './dates'

const ctx = { yearStart: 2026 }
const parse = (text: string) => parseTitleDate(text, ctx)

describe('parseTitleDate: real Blackboard titles', () => {
  it('reads a day and month with no year into the academic year', () => {
    expect(parse('Formative Discussion Post I, due 13 November')).toEqual({ date: '2026-11-13' })
    expect(parse('Formative Discussion Posts Due 11 December')).toEqual({ date: '2026-12-11' })
  })

  it('reads an ordinal day, a written year and a 12-hour time', () => {
    expect(parse('Summative Essay due 16th February 2027 by 2pm (CMP002/ESFN41)')).toEqual({
      date: '2027-02-16',
      time: '14:00',
    })
    expect(parse('Formative Essay due 24th November 2026 by 2pm')).toEqual({ date: '2026-11-24', time: '14:00' })
  })

  it('reads a weekday, abbreviated month and morning time', () => {
    expect(parse('Lecture 1 - Mon 5th Oct 2026, 10am, ER201')).toEqual({ date: '2026-10-05', time: '10:00' })
  })

  it('reads a weekday with a comma and a trailing colon', () => {
    expect(parse('Monday, 9 November: Borders and Migration (Prof Lauren Martin)')).toEqual({ date: '2026-11-09' })
  })

  it('reads a date in brackets after a teaching-week label', () => {
    expect(parse('BLOCK 1.1, DRB, Week 1 (5 October) - Conservation')).toEqual({ date: '2026-10-05' })
    expect(parse('BLOCK 1.2, DRB, Week 5 (2 November)')).toEqual({ date: '2026-11-02' })
    expect(parse('Week 2 (12 October)')).toEqual({ date: '2026-10-12' })
  })

  it('reads an abbreviated month with a full stop', () => {
    expect(parse('Reading for 9 Nov.')).toEqual({ date: '2026-11-09' })
  })

  it('reads UK day-first numeric dates', () => {
    expect(parse('Deadline 12/11/2026')).toEqual({ date: '2026-11-12' })
    expect(parse('Deadline 12.11.26 at 14:30')).toEqual({ date: '2026-11-12', time: '14:30' })
    expect(parse('Uploaded 2026-11-12')).toEqual({ date: '2026-11-12' })
  })

  it('reads same-month and cross-month ranges', () => {
    expect(parse('2-6 November: Workshop I - Crisis of Democracy')).toEqual({ date: '2026-11-02', endDate: '2026-11-06' })
    expect(parse('30 November-4 December: Workshop on Border Crises')).toEqual({
      date: '2026-11-30',
      endDate: '2026-12-04',
    })
    expect(parse('28 December – 1 January')).toEqual({ date: '2026-12-28', endDate: '2027-01-01' })
  })

  it('takes the start of a 24-hour time range', () => {
    expect(parse('Tutorial on 13 November, 11:00-12.00, W007')).toEqual({ date: '2026-11-13', time: '11:00' })
    // A number straight after a session word is an ordinal, so this one is left to the AI.
    expect(parse('Tutorial 13 November')).toBeNull()
  })

  it('reads noon and 12am/12pm correctly', () => {
    expect(parse('Due 3 March by 12 noon')).toEqual({ date: '2027-03-03', time: '12:00' })
    expect(parse('Due 3 March by 12pm')).toEqual({ date: '2027-03-03', time: '12:00' })
    expect(parse('Due 3 March by 12am')).toEqual({ date: '2027-03-03', time: '00:00' })
  })

  it('reads a month-first date', () => {
    expect(parse('Due November 13th, 2026')).toEqual({ date: '2026-11-13' })
  })

  it('takes the first date when there are several', () => {
    expect(parse('Released 5 October, due 13 November')).toEqual({ date: '2026-10-05' })
  })
})

describe('parseTitleDate: academic year placement', () => {
  it('puts Aug–Dec in yearStart and Jan–Jul in yearStart + 1', () => {
    expect(parse('1 August')?.date).toBe('2026-08-01')
    expect(parse('31 July')?.date).toBe('2027-07-31')
    expect(parse('7 May')?.date).toBe('2027-05-07')
    expect(parseTitleDate('7 May', { yearStart: 2027 })?.date).toBe('2028-05-07')
  })

  it('keeps a written year as written', () => {
    expect(parse('5 October 2025')?.date).toBe('2025-10-05')
  })
})

describe('parseTitleDate: things that are not dates', () => {
  it('never reads week, lecture or block numbers', () => {
    expect(parse('Week 12: Introduction Lecture')).toBeNull()
    expect(parse('Weeks 13-15: Geographic Research')).toBeNull()
    expect(parse('Lecture 3')).toBeNull()
    expect(parse('BLOCK 1.2')).toBeNull()
    expect(parse('Block 1: Climate')).toBeNull()
    expect(parse('L3: Rivers and floods')).toBeNull()
    expect(parse('Start Here - Module Information')).toBeNull()
  })

  it('does not read a week number followed by a month as a day', () => {
    expect(parse('Week 3 November reading')).toBeNull()
    expect(parse('Lecture 3 November')).toBeNull()
  })

  it('rejects impossible dates', () => {
    expect(parse('31 November')).toBeNull()
    expect(parse('30 February')).toBeNull()
    expect(parse('29 February')).toBeNull() // 2027 is not a leap year
    expect(parseTitleDate('29 February', { yearStart: 2027 })?.date).toBe('2028-02-29')
    expect(parse('31/04/2027')).toBeNull()
    expect(parse('13/13/2026')).toBeNull()
  })

  it('skips the verb "may" and numbers with no month', () => {
    expect(parse('Chapter 3 may help')).toBeNull()
    expect(parse('Read pages 3 may be useful')).toBeNull()
    expect(parse('Workshop on 12 sites')).toBeNull()
  })

  it('does not read a backwards range as a range', () => {
    expect(parse('6-2 November')).toEqual({ date: '2026-11-02' })
  })

  it('keeps only the start of a span longer than a fortnight', () => {
    expect(parse('1 October - 30 November: Block 1')).toEqual({ date: '2026-10-01' })
  })

  it('does not read a section number as a time', () => {
    expect(parse('BLOCK 1.10 - 5 October')).toEqual({ date: '2026-10-05' })
  })
})

describe('date keys', () => {
  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26') // clocks go back 25 Oct 2026
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-10-05', -77)).toBe('2026-07-20')
  })

  it('counts days between keys', () => {
    expect(daysBetween('2026-07-20', '2026-10-05')).toBe(77)
    expect(daysBetween('2026-10-05', '2026-07-20')).toBe(-77)
  })

  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-10-05')).toBe('2026-10-05')
    expect(mondayOf('2026-10-11')).toBe('2026-10-05') // Sunday
    expect(mondayOf('2026-11-12')).toBe('2026-11-09')
    expect(mondayOf('2027-03-31')).toBe('2027-03-29') // just after the clocks go forward
  })

  it('validates keys', () => {
    expect(isDateKey('2026-11-12')).toBe(true)
    expect(isDateKey('2026-02-30')).toBe(false)
    expect(isDateKey('12/11/2026')).toBe(false)
    expect(isDateKey(null)).toBe(false)
  })

  it('reads the academic year start', () => {
    expect(academicYearStart('2026-11-12')).toBe(2026)
    expect(academicYearStart('2027-02-16')).toBe(2026)
    expect(academicYearStart('2027-08-01')).toBe(2027)
    // 23:30 UTC on 31 Jul 2027 is already 1 Aug in London (BST).
    expect(academicYearStart(new Date('2027-07-31T23:30:00Z'))).toBe(2027)
  })

  it("reads today's London day, not UTC's", () => {
    expect(londonToday(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01')
    expect(londonToday(new Date('2026-12-31T23:30:00Z'))).toBe('2026-12-31')
  })
})
