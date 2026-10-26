import { describe, expect, it } from 'vitest'
import {
  calendarEventSession,
  calendarEventUid,
  countByStatus,
  countReadingsBySession,
  countTasksBySession,
  groupByModule,
  assignmentLists,
  isOverdue,
  parseSessionTitle,
  postStatus,
  prepStatus,
  splitByTime,
  trackedPrep,
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
  it('is red with nothing added, amber until handed in', () => {
    expect(prepStatus({ done: 0, total: 0 }, false)).toBe('red')
    expect(prepStatus({ done: 1, total: 3 }, false)).toBe('amber')
    expect(prepStatus({ done: 0, total: 2 }, false)).toBe('amber')
  })

  it('stays amber with every reading ticked until marked as done', () => {
    expect(prepStatus({ done: 2, total: 2 }, false)).toBe('amber')
    expect(prepStatus({ done: 2, total: 2 }, true)).toBe('green')
  })

  it('is green when handed in, whatever is ticked', () => {
    expect(prepStatus({ done: 0, total: 0 }, true)).toBe('green')
    expect(prepStatus({ done: 0, total: 1 }, true)).toBe('green')
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
      states: new Map([['u1', { prep_done_at: null, notes_done_at: '2026-10-19T18:00:00Z', note: 'ok' }]]),
      workspaceByCode: new Map([['GEOG1081', 'ws1']]),
    })
    expect(joined).toMatchObject({
      status: 'amber',
      // Follow-up waits for the hand-in, even if already marked done.
      postStatus: 'pending',
      notesDone: true,
      note: 'ok',
      workspaceId: 'ws1',
      source: 'timetable',
      tracked: true,
    })
  })

  it('counts prep tasks into the left half and concepts into the right', () => {
    const tasks = countTasksBySession([
      { session_uid: 'u1', phase: 'prep', done_at: '2026-10-18T10:00:00Z' },
      { session_uid: 'u1', phase: 'post', done_at: null },
      { session_uid: 'u2', phase: 'prep', done_at: null },
    ])
    expect(tasks.get('u1')).toEqual({ prep: { done: 1, total: 1 }, post: { done: 0, total: 1 } })

    const [joined] = withPrep([session({})], {
      readings: new Map([['u1', { done: 0, total: 1 }]]),
      tasks,
      states: new Map([['u1', { prep_done_at: '2026-10-19T09:00:00Z', notes_done_at: null, note: null }]]),
      workspaceByCode: new Map(),
      now: new Date('2026-10-20T00:00:00Z'),
    })
    expect(joined).toMatchObject({ status: 'green', postStatus: 'amber' })
  })
})

describe('postStatus', () => {
  it('is pending until prep is handed in', () => {
    expect(postStatus({ done: 0, total: 0 }, false, false, true)).toBe('pending')
    expect(postStatus({ done: 1, total: 2 }, true, false, true)).toBe('pending')
  })

  it('is pending before the session and red after it with nothing recorded', () => {
    expect(postStatus({ done: 0, total: 0 }, false, true, false)).toBe('pending')
    expect(postStatus({ done: 0, total: 0 }, false, true, true)).toBe('red')
  })

  it('is amber with concepts outstanding, green when all ticked or marked done', () => {
    expect(postStatus({ done: 1, total: 2 }, false, true, true)).toBe('amber')
    expect(postStatus({ done: 2, total: 2 }, false, true, true)).toBe('green')
    expect(postStatus({ done: 0, total: 2 }, true, true, true)).toBe('green')
    expect(postStatus({ done: 0, total: 0 }, true, true, false)).toBe('green')
  })
})

describe('isOverdue', () => {
  const states = (notes: string | null, prepDone: string | null) =>
    new Map([['u1', { prep_done_at: prepDone, notes_done_at: notes, note: null }]])
  const join = (st: ReturnType<typeof states>, now: Date) =>
    withPrep([session({})], { readings: new Map(), states: st, workspaceByCode: new Map(), now })[0]
  const after = new Date('2026-10-20T00:00:00Z')

  it('is only for ended sessions', () => {
    const before = new Date('2026-10-19T10:00:00Z')
    expect(isOverdue(join(states(null, null), before), before)).toBe(false)
    expect(isOverdue(join(states(null, null), after), after)).toBe(true)
  })

  it('clears once prep is handed in, with follow-up still open', () => {
    expect(isOverdue(join(states('2026-10-19T18:00:00Z', null), after), after)).toBe(true)
    expect(isOverdue(join(states(null, '2026-10-19T09:00:00Z'), after), after)).toBe(false)
  })
})

describe('tracked Google events', () => {
  const event = { id: 'abc', title: 'Academic advisor', start: '2026-10-19T10:00:00Z', end: '2026-10-19T10:30:00Z' }

  it('only tracked rows with a gcal uid come back', () => {
    const rows = [
      { uid: calendarEventUid('abc'), tracked: true, prep_done_at: null, notes_done_at: null, note: null },
      { uid: calendarEventUid('off'), tracked: false, prep_done_at: null, notes_done_at: null, note: null },
      { uid: 'ics-1', tracked: true, prep_done_at: null, notes_done_at: null, note: null },
    ]
    expect(trackedPrep(rows, new Map()).map((t) => t.uid)).toEqual(['gcal:abc'])
  })

  it('builds a session from the event, untracked without prep', () => {
    const now = new Date('2026-10-19T09:00:00Z')
    expect(calendarEventSession(event, null, now)).toMatchObject({
      uid: 'gcal:abc',
      source: 'calendar',
      tracked: false,
      moduleName: 'Academic advisor',
      moduleCode: null,
    })
    const prep = {
      uid: 'gcal:abc',
      tasks: { prep: { done: 1, total: 1 }, post: { done: 0, total: 0 } },
      prepDone: true,
      notesDone: false,
      note: null,
    }
    expect(calendarEventSession(event, prep, now)).toMatchObject({ tracked: true, status: 'green', postStatus: 'pending' })
    expect(calendarEventSession(event, { ...prep, prepDone: false }, now)).toMatchObject({ status: 'amber' })
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

describe('assignmentLists', () => {
  const now = new Date('2026-10-26T12:00:00Z')
  const at = (uid: string, start: string, prepDone: boolean, moduleCode: string | null = 'GEOG1081') => ({
    ...session({ uid, start, end: start.replace('T10', 'T11'), moduleCode }),
    prepDone,
  })
  const lists = assignmentLists(
    [
      at('past-open', '2026-10-20T10:00:00.000Z', false),
      at('past-done', '2026-10-22T10:00:00.000Z', true),
      at('future-done', '2026-10-28T10:00:00.000Z', true),
      at('future-open-late', '2026-10-30T10:00:00.000Z', false),
      at('future-open', '2026-10-27T10:00:00.000Z', false),
      at('uncoded', '2026-10-21T10:00:00.000Z', false, null),
    ],
    now
  )
  const uids = (list: { uid: string }[]) => list.map((s) => s.uid)

  it('lists upcoming soonest first, the rest most recent first', () => {
    expect(uids(lists.upcoming)).toEqual(['future-open', 'future-open-late'])
    expect(uids(lists.pastDue)).toEqual(['past-open'])
    expect(uids(lists.completed)).toEqual(['future-done', 'past-done'])
  })

  it('puts handed-in future sessions at the top of history', () => {
    expect(uids(lists.history)).toEqual(['future-done', 'past-done', 'past-open'])
  })
})
