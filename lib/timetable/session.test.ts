import { describe, expect, it } from 'vitest'
import {
  countByStatus,
  countReadingsBySession,
  groupByModule,
  parseSessionTitle,
  prepStatus,
  splitByTime,
  withPrep,
  type TimetableSession,
} from './session'
import { parseIcs, sessionsInRange } from './ics'

const session = (over: Partial<TimetableSession>): TimetableSession => ({
  uid: 'u1',
  title: 'GEOG1081: Physical Geography - Lecture',
  moduleCode: 'GEOG1081',
  moduleName: 'Physical Geography',
  type: 'Lecture',
  start: '2026-10-19T16:00:00.000Z',
  end: '2026-10-19T17:00:00.000Z',
  location: 'W103',
  ...over,
})

describe('parseSessionTitle', () => {
  it('splits MyTimetable titles into code, module and type', () => {
    expect(parseSessionTitle('GEOG1081: Physical Geography - Lecture')).toEqual({
      moduleCode: 'GEOG1081',
      moduleName: 'Physical Geography',
      type: 'Lecture',
    })
    expect(parseSessionTitle('GEOG1241: Geographies of Crisis - Online Session')).toEqual({
      moduleCode: 'GEOG1241',
      moduleName: 'Geographies of Crisis',
      type: 'Online Session',
    })
  })

  it('splits on the last dash, so a hyphenated module name survives', () => {
    expect(parseSessionTitle('GEOG1222: Introduction to Geographical Research (BA) - Lecture').moduleName).toBe(
      'Introduction to Geographical Research (BA)'
    )
    expect(parseSessionTitle('GEOG2001: Nature - Society Relations - Seminar')).toMatchObject({
      moduleName: 'Nature - Society Relations',
      type: 'Seminar',
    })
  })

  it('collapses the repeated name on uncoded MyTimetable events', () => {
    expect(parseSessionTitle('University College UG Welcome Talks: University College UG Welcome Talks - Induction Event')).toEqual({
      moduleCode: null,
      moduleName: 'University College UG Welcome Talks',
      type: 'Induction Event',
    })
  })

  it('keeps unparseable titles with no code', () => {
    expect(parseSessionTitle('Freshers fair')).toEqual({ moduleCode: null, moduleName: 'Freshers fair', type: 'Session' })
  })
})

describe('prepStatus', () => {
  it('is red with no readings, amber part-way, green when all done', () => {
    expect(prepStatus({ done: 0, total: 0 }, false)).toBe('red')
    expect(prepStatus({ done: 1, total: 3 }, false)).toBe('amber')
    expect(prepStatus({ done: 0, total: 2 }, false)).toBe('amber')
    expect(prepStatus({ done: 2, total: 2 }, false)).toBe('green')
  })

  it('is green when marked as having no readings', () => {
    expect(prepStatus({ done: 0, total: 0 }, true)).toBe('green')
  })

  it('lets added readings win over "no readings"', () => {
    expect(prepStatus({ done: 0, total: 1 }, true)).toBe('amber')
  })
})

describe('countReadingsBySession / withPrep', () => {
  it('counts readings per session and joins state and workspace', () => {
    const readings = countReadingsBySession([
      { session_uid: 'u1', completed_at: '2026-10-18T10:00:00Z' },
      { session_uid: 'u1', completed_at: null },
      { session_uid: null, completed_at: null },
    ])
    expect(readings.get('u1')).toEqual({ done: 1, total: 2 })

    const [joined] = withPrep([session({})], {
      readings,
      states: new Map([['u1', { no_readings: false, notes_done_at: '2026-10-19T18:00:00Z', note: 'ok' }]]),
      workspaceByCode: new Map([['GEOG1081', 'ws1']]),
    })
    expect(joined).toMatchObject({ status: 'amber', notesDone: true, note: 'ok', workspaceId: 'ws1' })
  })
})

describe('grouping', () => {
  it('groups by module code and skips uncoded sessions', () => {
    const groups = groupByModule([
      session({ uid: 'b', moduleCode: 'GEOG1241', moduleName: 'Geographies of Crisis' }),
      session({ uid: 'a2', start: '2026-10-21T10:00:00.000Z' }),
      session({ uid: 'a1' }),
      session({ uid: 'x', moduleCode: null }),
    ])
    expect(groups.map((g) => g.code)).toEqual(['GEOG1081', 'GEOG1241'])
    expect(groups[0].sessions.map((s) => s.uid)).toEqual(['a1', 'a2'])
  })

  it('splits upcoming (soonest first) from past (latest first) by end time', () => {
    const now = new Date('2026-10-19T16:30:00Z')
    const { upcoming, past } = splitByTime(
      [
        session({ uid: 'now' }),
        session({ uid: 'later', start: '2026-10-21T10:00:00.000Z', end: '2026-10-21T11:00:00.000Z' }),
        session({ uid: 'old', start: '2026-10-12T10:00:00.000Z', end: '2026-10-12T11:00:00.000Z' }),
        session({ uid: 'older', start: '2026-10-05T10:00:00.000Z', end: '2026-10-05T11:00:00.000Z' }),
      ],
      now
    )
    expect(upcoming.map((s) => s.uid)).toEqual(['now', 'later'])
    expect(past.map((s) => s.uid)).toEqual(['old', 'older'])
  })

  it('counts statuses', () => {
    expect(countByStatus([{ status: 'red' }, { status: 'green' }, { status: 'red' }])).toEqual({
      red: 2,
      amber: 0,
      green: 1,
    })
  })
})

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//MyTimetable//EN',
  'BEGIN:VEVENT',
  'UID:abc-1',
  'DTSTART:20261019T160000Z',
  'DTEND:20261019T170000Z',
  'SUMMARY:GEOG1081: Physical Geography - Lecture',
  'DESCRIPTION:Physical Geography',
  'LOCATION:W103',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:abc-2',
  'DTSTART:20261020T100000Z',
  'DTEND:20261020T110000Z',
  'SUMMARY:GEOG1241: Geographies of Crisis - Online Sess',
  ' ion',
  'LOCATION:Not Specified',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:abc-3',
  'STATUS:CANCELLED',
  'DTSTART:20261021T100000Z',
  'DTEND:20261021T110000Z',
  'SUMMARY:GEOG1081: Physical Geography - Lecture',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:weekly',
  'DTSTART:20261022T090000Z',
  'DTEND:20261022T100000Z',
  'RRULE:FREQ=WEEKLY;COUNT=3',
  'SUMMARY:GEOG1071: Human Geography - Seminar',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('parseIcs', () => {
  const sessions = parseIcs(ICS)

  it('parses events, unfolds lines and drops cancelled ones', () => {
    expect(sessions.find((s) => s.uid === 'abc-1')).toMatchObject({
      moduleCode: 'GEOG1081',
      type: 'Lecture',
      start: '2026-10-19T16:00:00.000Z',
      end: '2026-10-19T17:00:00.000Z',
      location: 'W103',
    })
    expect(sessions.find((s) => s.uid === 'abc-2')?.type).toBe('Online Session')
    expect(sessions.some((s) => s.uid === 'abc-3')).toBe(false)
  })

  it('expands recurring events with one uid per occurrence', () => {
    const weekly = sessions.filter((s) => s.uid.startsWith('weekly#'))
    expect(weekly).toHaveLength(3)
    expect(new Set(weekly.map((s) => s.uid)).size).toBe(3)
  })

  it('filters to a range', () => {
    const inRange = sessionsInRange(sessions, '2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z')
    expect(inRange.map((s) => s.uid)).toEqual(['abc-1'])
  })
})
