import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/blackboard/dates'
import {
  MAX_SESSION_LINES,
  moduleSessions,
  normaliseSessions,
  sessionKindsIn,
  sessionLine,
  sessionsForBatch,
  sessionTypeOf,
  type ModuleSession,
} from './sessions'

describe('sessionTypeOf', () => {
  it('maps timetable types onto the classifier vocabulary', () => {
    expect(sessionTypeOf('Lecture')).toBe('lecture')
    expect(sessionTypeOf('Online Workshop')).toBe('workshop')
    expect(sessionTypeOf('Tutorials')).toBe('tutorial')
    expect(sessionTypeOf('Computer Practical')).toBe('practical')
    expect(sessionTypeOf('Field Trip')).toBe('fieldwork')
    expect(sessionTypeOf('Exam')).toBe('test')
    expect(sessionTypeOf('Online Session')).toBe('other')
    expect(sessionTypeOf('')).toBe('other')
  })
})

describe('moduleSessions', () => {
  it("keeps one module's sessions as London days, one per day and type, sorted", () => {
    const feed = [
      { moduleCode: 'GEOG1061', type: 'Tutorial', start: '2026-11-12T14:00:00Z' },
      { moduleCode: 'GEOG1061', type: 'Lecture', start: '2026-11-09T10:00:00Z' },
      { moduleCode: 'GEOG1061', type: 'Lecture', start: '2026-11-09T15:00:00Z' },
      // 23:30 UTC in BST is the next London day.
      { moduleCode: 'GEOG1061', type: 'Practical', start: '2026-10-05T23:30:00Z' },
      { moduleCode: 'GEOG1081', type: 'Seminar', start: '2026-11-10T10:00:00Z' },
      { moduleCode: null, type: 'Session', start: '2026-11-10T10:00:00Z' },
    ]
    expect(moduleSessions(feed, 'geog1061')).toEqual([
      { date: '2026-10-06', type: 'practical' },
      { date: '2026-11-09', type: 'lecture' },
      { date: '2026-11-12', type: 'tutorial' },
    ])
    expect(moduleSessions(feed, null)).toEqual([])
  })

  it('normalises raw fixture rows the same way and drops bad dates', () => {
    expect(normaliseSessions([{ date: '2026-11-12', type: 'Online Tutorial' }, { date: '2026-02-30', type: 'Lecture' }])).toEqual([
      { date: '2026-11-12', type: 'tutorial' },
    ])
  })
})

describe('sessionsForBatch', () => {
  // A lecture every Monday and a tutorial every Thursday, autumn to spring.
  const all: ModuleSession[] = []
  for (let d = '2026-09-28'; d < '2027-03-01'; d = addDays(d, 7)) {
    all.push({ date: d, type: 'lecture' }, { date: addDays(d, 3), type: 'tutorial' })
  }

  it('lists 7 days before to 35 days after the posted day', () => {
    const list = sessionsForBatch(all, ['2026-11-03T09:00:00Z'], '2026-11-13')
    expect(list[0].date).toBe('2026-10-29')
    expect(list[list.length - 1].date).toBe('2026-12-07')
    expect(list.every((s) => s.date >= '2026-10-27' && s.date <= '2026-12-08')).toBe(true)
  })

  it('uses today for a source with no posted day', () => {
    const list = sessionsForBatch(all, [null], '2026-11-13')
    expect(list[0].date).toBe('2026-11-09')
    expect(list[list.length - 1].date).toBe('2026-12-17')
  })

  it("covers each source's own window when a batch spans months, within the cap", () => {
    const list = sessionsForBatch(all, ['2026-10-01', '2027-01-20'], '2026-11-13')
    const days = list.map((s) => s.date)
    expect(days).toContain('2026-10-05')
    expect(days).toContain('2027-01-21')
    expect(days).not.toContain('2026-12-03')
    expect(list.length).toBeLessThanOrEqual(MAX_SESSION_LINES)
  })

  it("caps at 40 lines, keeping every source's nearest sessions", () => {
    const dense: ModuleSession[] = []
    for (let d = '2026-10-01'; d < '2027-01-31'; d = addDays(d, 1)) dense.push({ date: d, type: 'lecture' })
    const list = sessionsForBatch(dense, ['2026-10-10', '2026-11-20', '2027-01-05'], '2026-11-13')
    expect(list).toHaveLength(MAX_SESSION_LINES)
    const days = list.map((s) => s.date)
    for (const a of ['2026-10-10', '2026-11-20', '2027-01-05']) {
      for (let i = 0; i < 10; i++) expect(days).toContain(addDays(a, i))
    }
    expect([...days].sort()).toEqual(days)
  })

  it('is empty with no sessions', () => {
    expect(sessionsForBatch([], ['2026-11-03'], '2026-11-13')).toEqual([])
  })
})

describe('sessionKindsIn / sessionLine', () => {
  it('reads the kinds of session a quote names', () => {
    expect(sessionKindsIn("Read chapter 2 before Thursday's tutorial")).toEqual(['tutorial'])
    expect(sessionKindsIn('Bring boots to the field trip and the practical')).toEqual(['fieldwork', 'practical'])
    expect(sessionKindsIn('Prepare for the next class')).toEqual(['any'])
    expect(sessionKindsIn('The lecturer will post the reading next week')).toEqual([])
  })

  it('formats a prompt line', () => {
    expect(sessionLine({ date: '2026-11-12', type: 'tutorial' })).toBe('2026-11-12 Thursday Tutorial')
    expect(sessionLine({ date: '2026-11-13', type: 'other' })).toBe('2026-11-13 Friday Other session')
  })
})
