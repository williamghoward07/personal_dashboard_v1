import { describe, expect, it } from 'vitest'
import type { TimetableSession } from './session'
import { collectTests, countdownLabel, daysUntil, isTestEventTitle, isTimetableTest, splitTests } from './tests'

const session = (over: Partial<TimetableSession>): TimetableSession => ({
  uid: 'u1',
  title: 'GEOG1222: Introduction to Geographical Research (BA) - Test',
  moduleCode: 'GEOG1222',
  moduleName: 'Introduction to Geographical Research (BA)',
  type: 'Test',
  start: '2026-12-02T13:00:00.000Z',
  end: '2026-12-02T14:00:00.000Z',
  location: 'TLC042',
  ...over,
})

const event = (title: string, start: string, over: Partial<{ id: string; allDay: boolean; end: string | null }> = {}) => ({
  id: over.id ?? title,
  title,
  allDay: over.allDay ?? false,
  start,
  end: over.end ?? null,
})

describe('isTimetableTest', () => {
  it('matches test-type sessions only', () => {
    expect(isTimetableTest({ type: 'Test' })).toBe(true)
    expect(isTimetableTest({ type: 'Examination' })).toBe(true)
    expect(isTimetableTest({ type: 'Lecture' })).toBe(false)
    // "Geography Quiz - Induction Event": the type is the induction.
    expect(isTimetableTest({ type: 'Induction Event' })).toBe(false)
  })
})

describe('isTestEventTitle', () => {
  it('finds tests and exams in Google titles', () => {
    expect(isTestEventTitle('GEOG1222/1232 – Summative In-Person E-test (25%)')).toBe(true)
    expect(isTestEventTitle('Main exam period (2026/27)')).toBe(true)
    expect(isTestEventTitle('Stats midterm')).toBe(true)
  })

  it('skips things that only mention one', () => {
    expect(isTestEventTitle('CIS Pub Quiz')).toBe(false)
    expect(isTestEventTitle('DUE 4pm – Critical Assessment of Methodology (group, 25%)')).toBe(false)
    expect(isTestEventTitle('Academic Advising – Group Meeting 5 (Exams & Revision Tips)')).toBe(false)
    expect(isTestEventTitle('Latest results')).toBe(false)
  })
})

describe('collectTests', () => {
  it('merges both sources in start order and drops Google copies of timetable tests', () => {
    const tests = collectTests(
      [session({}), session({ uid: 'lec', type: 'Lecture' })],
      [
        event('GEOG1222/1232 – Summative In-Person E-test (25%)', '2026-12-02T13:00:00Z'),
        event('Main exam period (2026/27)', '2027-05-10', { allDay: true }),
        event('Mock exam', '2026-11-20T10:00:00Z', { id: 'mock' }),
      ]
    )
    expect(tests.map((t) => t.id)).toEqual(['gcal:mock', 'u1', 'gcal:Main exam period (2026/27)'])
    expect(tests[1]).toMatchObject({ source: 'timetable', moduleCode: 'GEOG1222', location: 'TLC042' })
  })
})

describe('splitTests', () => {
  it('splits on the end time, past most recent first', () => {
    const now = new Date('2026-12-02T13:30:00Z')
    const tests = collectTests(
      [session({}), session({ uid: 'old', start: '2026-10-01T09:00:00Z', end: '2026-10-01T10:00:00Z' })],
      [event('Exam', '2026-11-01T09:00:00Z', { id: 'nov' })]
    )
    const { upcoming, past } = splitTests(tests, now)
    // In progress still counts as upcoming.
    expect(upcoming.map((t) => t.id)).toEqual(['u1'])
    expect(past.map((t) => t.id)).toEqual(['gcal:nov', 'old'])
  })

  it('keeps an all-day test upcoming through its own day', () => {
    const allDay = collectTests([], [event('Exam day', '2026-12-02', { allDay: true, end: '2026-12-03' })])
    expect(splitTests(allDay, new Date('2026-12-02T20:00:00Z')).upcoming).toHaveLength(1)
    expect(splitTests(allDay, new Date('2026-12-03T01:00:00Z')).past).toHaveLength(1)
  })
})

describe('daysUntil / countdownLabel', () => {
  it('counts London calendar days', () => {
    const now = new Date('2026-11-12T23:30:00Z')
    expect(daysUntil({ start: '2026-11-13T09:00:00Z', allDay: false }, now)).toBe(1)
    expect(daysUntil({ start: '2026-11-12', allDay: true }, now)).toBe(0)
    expect(countdownLabel(0)).toBe('Today')
    expect(countdownLabel(1)).toBe('Tomorrow')
    expect(countdownLabel(5)).toBe('In 5 days')
    expect(countdownLabel(20)).toBe('In 3 weeks')
    expect(countdownLabel(176)).toBe('In 6 months')
  })
})
