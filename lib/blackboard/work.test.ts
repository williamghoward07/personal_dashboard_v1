import { describe, expect, it } from 'vitest'
import { assignmentLists, type SessionWithPrep } from '@/lib/timetable/session'
import type { BbAssignmentRecord, BbCourseRecord, BbKeyDate } from './types'
import {
  WORK_CATEGORIES,
  WORK_CATEGORY_LABEL,
  applyWorkFilter,
  dueWithin,
  isWorkPastDue,
  syncStatus,
  workDueInstant,
  toWorkItems,
  workCategory,
  workLists,
  type SyncRun,
  type WorkInput,
  type WorkItem,
} from './work'

// ---------------------------------------------------------------- fixtures --

function course(over: Partial<BbCourseRecord> & Pick<BbCourseRecord, 'id'>): BbCourseRecord {
  return {
    user_id: 'u',
    bb_id: `_${over.id}_1`,
    course_code: `${over.module_code ?? 'X_ORG'}_2026`,
    module_code: null,
    name: 'Course',
    term: null,
    workspace_id: null,
    week_offset: 0,
    url: `https://blackboard.durham.ac.uk/ultra/courses/_${over.id}_1/outline`,
    first_seen_at: '2026-11-12T00:00:00Z',
    last_seen_at: '2026-11-12T00:00:00Z',
    removed_at: null,
    ...over,
  }
}

const COURSES = [
  course({ id: 'c1081', module_code: 'GEOG1081', name: 'Physical Geography' }),
  course({ id: 'c1061', module_code: 'GEOG1061', name: 'Environment and Society' }),
  course({ id: 'c1222', module_code: 'GEOG1222', name: 'Geographic Research' }),
  course({ id: 'corg', module_code: null, name: 'Academic Integrity (UG)' }),
]

function assignment(over: Partial<BbAssignmentRecord> & Pick<BbAssignmentRecord, 'id' | 'title'>): BbAssignmentRecord {
  return {
    user_id: 'u',
    bb_id: `todo:${over.id}`,
    course_id: 'c1081',
    due_at: null,
    bb_content_id: null,
    status: 'not_submitted',
    is_formative: null,
    url: `https://blackboard.durham.ac.uk/ultra/a/${over.id}`,
    done_at: null,
    first_seen_at: '2026-11-12T00:00:00Z',
    last_seen_at: '2026-11-12T00:00:00Z',
    removed_at: null,
    ...over,
  }
}

function keyDate(over: Partial<BbKeyDate> & Pick<BbKeyDate, 'id' | 'due_on'>): BbKeyDate {
  return {
    user_id: 'u',
    course_id: 'c1081',
    announcement_id: null,
    content_id: 'content-1',
    document_id: null,
    title: 'Formative Discussion Post I',
    category: 'formative',
    due_at: null,
    ai_due_on: over.due_on,
    for_session_type: null,
    for_week: null,
    quote: 'Formative Discussion Post I, due 13 November',
    status: 'suggested',
    assignment_id: null,
    done_at: null,
    fingerprint: over.id,
    model: 'gemini',
    updated_at: '2026-11-12T00:00:00Z',
    created_at: '2026-11-12T00:00:00Z',
    ...over,
  }
}

let seq = 0
function session(over: Partial<SessionWithPrep> & Pick<SessionWithPrep, 'start'>): SessionWithPrep {
  seq += 1
  return {
    uid: `s${seq}@mytimetable`,
    title: 'GEOG1081: Physical Geography - Lecture',
    moduleCode: 'GEOG1081',
    moduleName: 'Physical Geography',
    type: 'Lecture',
    end: new Date(Date.parse(over.start) + 3_600_000).toISOString(),
    location: 'ER201',
    source: 'timetable',
    tracked: true,
    readings: { done: 0, total: 0 },
    tasks: { prep: { done: 0, total: 0 }, post: { done: 0, total: 0 } },
    prepDone: false,
    prepDoneAt: null,
    notesDone: false,
    note: null,
    status: 'red',
    postStatus: 'pending',
    workspaceId: null,
    ...over,
  }
}

const NOW = new Date('2026-11-12T10:00:00Z')

function build(over: Partial<WorkInput>): WorkItem[] {
  return toWorkItems({ courses: COURSES, assignments: [], keyDates: [], sessions: [], now: NOW, ...over })
}

const keys = (items: WorkItem[]) => items.map((i) => i.key)
const one = (items: WorkItem[], key: string) => {
  const item = items.find((i) => i.key === key)
  if (!item) throw new Error(`no ${key}`)
  return item
}

// ------------------------------------------------------------------- tests --

describe('workCategory', () => {
  it('trusts the formative flag, then the title', () => {
    expect(workCategory({ is_formative: true, title: 'Essay' })).toBe('formative')
    expect(workCategory({ is_formative: false, title: 'Formative Essay' })).toBe('summative')
    expect(workCategory({ is_formative: null, title: 'Summative Essay due 16th February 2027 by 2pm (CMP002/ESFN41)' })).toBe(
      'summative'
    )
    expect(workCategory({ is_formative: null, title: 'Formative Essay due 24th November 2026 by 2pm' })).toBe('formative')
    expect(workCategory({ is_formative: null, title: 'Recognising Plagiarism Quiz' })).toBe('test')
    expect(workCategory({ is_formative: null, title: 'GIS Test' })).toBe('test')
    expect(workCategory({ is_formative: null, title: 'Fieldwork reflection' })).toBe('other')
  })

  it('labels every category', () => {
    expect(WORK_CATEGORIES.map((c) => WORK_CATEGORY_LABEL[c])).toEqual([
      'Summative',
      'Formative',
      'Tests',
      'Tutorial work',
      'Session tasks',
      'Other',
      'Lecture prep',
    ])
  })
})

describe('toWorkItems: official assignments', () => {
  it("Blackboard's submitted/graded beats the dashboard's done_at", () => {
    const items = build({
      assignments: [
        assignment({ id: 'a', title: 'Formative Essay due 24th November 2026 by 2pm', status: 'submitted', done_at: '2026-11-10T00:00:00Z' }),
        assignment({ id: 'b', title: 'Recognising Plagiarism Quiz', course_id: 'corg', status: 'graded' }),
        assignment({ id: 'c', title: 'Reflective log', done_at: '2026-11-10T00:00:00Z' }),
        assignment({ id: 'd', title: 'Reflective log 2' }),
      ],
    })
    expect(one(items, 'bba:a')).toMatchObject({ done: true, doneVia: 'blackboard', bbStatus: 'submitted' })
    expect(one(items, 'bba:b')).toMatchObject({ done: true, doneVia: 'blackboard', bbStatus: 'graded' })
    expect(one(items, 'bba:c')).toMatchObject({ done: true, doneVia: 'dashboard' })
    expect(one(items, 'bba:d')).toMatchObject({ done: false, doneVia: null })
  })

  it('reads the London day and time of a due date, and carries course and links', () => {
    const items = build({
      assignments: [
        assignment({
          id: 'sum',
          course_id: 'c1061',
          title: 'Summative Essay due 16th February 2027 by 2pm (CMP002/ESFN41)',
          due_at: '2027-02-16T14:00:00Z',
        }),
      ],
    })
    expect(one(items, 'bba:sum')).toMatchObject({
      source: 'assignment',
      category: 'summative',
      moduleCode: 'GEOG1061',
      courseName: 'Environment and Society',
      dueOn: '2027-02-16',
      dueAt: '2027-02-16T14:00:00Z',
      ai: null,
      url: 'https://blackboard.durham.ac.uk/ultra/a/sum',
      assignmentId: 'sum',
    })
  })

  it('a late-evening BST due time lands on the next London day', () => {
    const items = build({ assignments: [assignment({ id: 'x', title: 'Post', due_at: '2026-10-20T23:30:00Z' })] })
    expect(one(items, 'bba:x').dueOn).toBe('2026-10-21')
  })

  it('an org-course item with no module code keeps its course name', () => {
    const items = build({ assignments: [assignment({ id: 'q', course_id: 'corg', title: 'Recognising Plagiarism Quiz' })] })
    expect(one(items, 'bba:q')).toMatchObject({ moduleCode: null, courseName: 'Academic Integrity (UG)', dueOn: null })
  })

  it('removed assignments are left out', () => {
    expect(build({ assignments: [assignment({ id: 'gone', title: 'Old', removed_at: '2026-11-01T00:00:00Z' })] })).toEqual([])
  })
})

describe('toWorkItems: AI key dates', () => {
  it('shows suggested and confirmed dates with their quote and source link; dismissed never appear', () => {
    const items = build({
      keyDates: [
        keyDate({ id: 's', due_on: '2026-11-13' }),
        keyDate({ id: 'c', due_on: '2026-12-11', status: 'confirmed', title: 'Formative Discussion Posts', content_id: null, announcement_id: 'ann' }),
        keyDate({ id: 'd', due_on: '2026-11-20', status: 'dismissed' }),
      ],
      contentUrlById: new Map([['content-1', 'https://blackboard.durham.ac.uk/content-1']]),
      announcementUrlById: new Map([['ann', 'https://blackboard.durham.ac.uk/ann']]),
    })
    expect(keys(items)).toEqual(['kd:s', 'kd:c'])
    expect(one(items, 'kd:s')).toMatchObject({
      source: 'key_date',
      category: 'formative',
      dueOn: '2026-11-13',
      dueAt: null,
      done: false,
      ai: { status: 'suggested', quote: 'Formative Discussion Post I, due 13 November', sourceUrl: 'https://blackboard.durham.ac.uk/content-1' },
      url: 'https://blackboard.durham.ac.uk/content-1',
      keyDateId: 's',
    })
    expect(one(items, 'kd:c').ai).toMatchObject({ status: 'confirmed', sourceUrl: 'https://blackboard.durham.ac.uk/ann' })
  })

  it("links a handbook date to the handbook's content item", () => {
    const items = build({
      keyDates: [keyDate({ id: 'h', due_on: '2027-01-15', content_id: null, document_id: 'doc' })],
      contentUrlById: new Map([['handbook', 'https://blackboard.durham.ac.uk/handbook']]),
      documentContentId: new Map([['doc', 'handbook']]),
    })
    expect(one(items, 'kd:h').ai?.sourceUrl).toBe('https://blackboard.durham.ac.uk/handbook')
  })

  it('marks a key date done from done_at', () => {
    const items = build({ keyDates: [keyDate({ id: 'k', due_on: '2026-11-13', done_at: '2026-11-12T09:00:00Z' })] })
    expect(one(items, 'kd:k')).toMatchObject({ done: true, doneVia: 'dashboard' })
  })

  it('folds a duplicate key date into its official assignment', () => {
    const items = build({
      assignments: [
        assignment({ id: 'dated', title: 'Formative Essay due 24th November 2026 by 2pm', due_at: '2026-11-24T14:00:00Z' }),
        assignment({ id: 'undated', title: 'Formative Discussion Post I' }),
      ],
      keyDates: [
        keyDate({ id: 'dup1', due_on: '2026-11-23', assignment_id: 'dated', title: 'Essay', done_at: '2026-11-01T00:00:00Z' }),
        keyDate({ id: 'dup2', due_on: '2026-11-13', due_at: '2026-11-13T12:00:00Z', assignment_id: 'undated' }),
        keyDate({ id: 'dup3', due_on: '2026-11-20', assignment_id: 'undated', status: 'dismissed' }),
      ],
    })
    expect(keys(items)).toEqual(['bba:dated', 'bba:undated'])
    // The official date and done state win; the key date adds nothing.
    expect(one(items, 'bba:dated')).toMatchObject({ dueOn: '2026-11-24', dueAt: '2026-11-24T14:00:00Z', done: false, ai: null })
    expect(one(items, 'bba:dated').dueFromKeyDateId).toBeUndefined()
    // No Blackboard date: the key date's date fills it.
    expect(one(items, 'bba:undated')).toMatchObject({
      dueOn: '2026-11-13',
      dueAt: '2026-11-13T12:00:00Z',
      dueFromKeyDateId: 'dup2',
      ai: null,
    })
  })
})

describe('toWorkItems: a key date whose assignment is gone', () => {
  it('shows a confirmed key date linked to an assignment that is not loaded', () => {
    const items = build({
      keyDates: [keyDate({ id: 'orphan', due_on: '2026-11-20', status: 'confirmed', assignment_id: 'not-loaded' })],
    })
    expect(keys(items)).toEqual(['kd:orphan'])
    expect(one(items, 'kd:orphan')).toMatchObject({ source: 'key_date', dueOn: '2026-11-20', keyDateId: 'orphan' })
  })

  it('shows a key date linked to a removed assignment, and never the removed assignment', () => {
    const items = build({
      assignments: [assignment({ id: 'gone', title: 'Formative Discussion Post I', removed_at: '2026-11-11T00:00:00Z' })],
      keyDates: [keyDate({ id: 'kd-gone', due_on: '2026-11-13', assignment_id: 'gone' })],
    })
    expect(keys(items)).toEqual(['kd:kd-gone'])
  })

  it('still folds into a live assignment', () => {
    const items = build({
      assignments: [assignment({ id: 'live', title: 'Formative Discussion Post I' })],
      keyDates: [keyDate({ id: 'kd-live', due_on: '2026-11-13', assignment_id: 'live' })],
    })
    expect(keys(items)).toEqual(['bba:live'])
    expect(one(items, 'bba:live')).toMatchObject({ dueOn: '2026-11-13', dueFromKeyDateId: 'kd-live' })
  })
})

describe('a due time left on another day by an edit', () => {
  // Edited from 11 Nov 14:00 to 26 Nov, with the old instant still stored.
  const stale = keyDate({ id: 'moved', due_on: '2026-11-26', due_at: '2026-11-11T14:00:00Z', status: 'confirmed' })

  it('trusts due_on: not past due on 12 Nov, due at the end of 26 Nov', () => {
    const items = build({ keyDates: [stale] })
    const item = one(items, 'kd:moved')
    expect(item).toMatchObject({ dueOn: '2026-11-26', dueAt: null })
    expect(isWorkPastDue(item, NOW)).toBe(false)
    expect(keys(workLists(items, NOW).upcoming)).toEqual(['kd:moved'])
    expect(workDueInstant(item)).toBe(Date.parse('2026-11-27T00:00:00Z'))
  })

  it('workDueInstant ignores a dueAt on another London day, and keeps one on the same day', () => {
    expect(workDueInstant({ dueOn: '2026-11-26', dueAt: '2026-11-11T14:00:00Z' })).toBe(Date.parse('2026-11-27T00:00:00Z'))
    expect(workDueInstant({ dueOn: '2026-11-26', dueAt: '2026-11-26T14:00:00Z' })).toBe(Date.parse('2026-11-26T14:00:00Z'))
    // 23:30 UTC on 20 Oct is 21 Oct in London: consistent.
    expect(workDueInstant({ dueOn: '2026-10-21', dueAt: '2026-10-20T23:30:00Z' })).toBe(Date.parse('2026-10-20T23:30:00Z'))
  })

  it('a folded key date with a stale time gives its assignment the day only', () => {
    const items = build({
      assignments: [assignment({ id: 'undated', title: 'Formative Discussion Post I' })],
      keyDates: [{ ...stale, assignment_id: 'undated' }],
    })
    expect(one(items, 'bba:undated')).toMatchObject({ dueOn: '2026-11-26', dueAt: null, dueFromKeyDateId: 'moved' })
  })
})

describe('toWorkItems: timetable sessions', () => {
  it('turns module sessions into lecture-prep items, done once handed in', () => {
    const a = session({ start: '2026-11-13T10:00:00Z' })
    const b = session({ start: '2026-11-10T10:00:00Z', prepDone: true, status: 'green', prepDoneAt: '2026-11-09T00:00:00Z' })
    const uncoded = session({ start: '2026-11-13T10:00:00Z', moduleCode: null })
    const google = session({ start: '2026-11-13T10:00:00Z', source: 'calendar', uid: 'gcal:x' })
    const items = build({ sessions: [a, b, uncoded, google] })
    expect(keys(items)).toEqual([`prep:${a.uid}`, `prep:${b.uid}`])
    expect(one(items, `prep:${a.uid}`)).toMatchObject({
      source: 'prep',
      category: 'lecture_prep',
      moduleCode: 'GEOG1081',
      courseName: 'Physical Geography',
      title: 'Physical Geography - Lecture',
      dueOn: '2026-11-13',
      dueAt: a.start,
      done: false,
      session: a,
    })
    expect(one(items, `prep:${b.uid}`)).toMatchObject({ done: true, doneVia: 'dashboard' })
  })

  it('a Test session becomes a test item (not prep) and completes once it has ended', () => {
    const test = session({
      moduleCode: 'GEOG1222',
      moduleName: 'Geographic Research',
      title: 'GEOG1222: Geographic Research - Test',
      type: 'Test',
      start: '2026-12-02T10:00:00Z',
      end: '2026-12-02T11:00:00Z',
    })
    const before = build({ sessions: [test], now: new Date('2026-12-02T10:30:00Z') })
    expect(keys(before)).toEqual([`test:${test.uid}`])
    expect(before[0]).toMatchObject({ source: 'session', category: 'test', done: false, courseName: 'Geographic Research' })
    // Under way: still upcoming, never past due.
    expect(workLists(before, new Date('2026-12-02T10:30:00Z')).upcoming).toHaveLength(1)

    const after = build({ sessions: [test], now: new Date('2026-12-02T11:00:01Z') })
    expect(after[0]).toMatchObject({ done: true, doneVia: 'session' })
    expect(workLists(after, new Date('2026-12-02T11:00:01Z')).completed).toHaveLength(1)
  })
})

describe('workLists', () => {
  it('past due at London midnight for a date-only item (BST)', () => {
    const items = build({ keyDates: [keyDate({ id: 'bst', due_on: '2026-10-24' })] })
    // 23:59:59 BST on 24 Oct is 22:59:59 UTC.
    expect(workLists(items, new Date('2026-10-24T22:59:59Z')).upcoming).toHaveLength(1)
    expect(workLists(items, new Date('2026-10-24T23:00:00Z')).pastDue).toHaveLength(1)
  })

  it('past due at London midnight for a date-only item (GMT)', () => {
    const items = build({ keyDates: [keyDate({ id: 'gmt', due_on: '2026-11-24' })] })
    expect(workLists(items, new Date('2026-11-24T23:59:59Z')).upcoming).toHaveLength(1)
    expect(workLists(items, new Date('2026-11-25T00:00:00Z')).pastDue).toHaveLength(1)
  })

  it('past due once a timed dueAt passes (GMT and BST)', () => {
    const items = build({
      assignments: [
        assignment({ id: 'gmt', title: 'Formative Essay due 24th November 2026 by 2pm', due_at: '2026-11-24T14:00:00Z' }),
        assignment({ id: 'bst', title: 'Formative Discussion Post', due_at: '2026-10-20T13:00:00Z' }), // 2pm BST
      ],
    })
    const gmt = one(items, 'bba:gmt')
    const bst = one(items, 'bba:bst')
    expect(isWorkPastDue(gmt, new Date('2026-11-24T14:00:00Z'))).toBe(false)
    expect(isWorkPastDue(gmt, new Date('2026-11-24T14:00:01Z'))).toBe(true)
    expect(isWorkPastDue(bst, new Date('2026-10-20T12:59:59Z'))).toBe(false)
    expect(isWorkPastDue(bst, new Date('2026-10-20T13:00:01Z'))).toBe(true)
  })

  it('sorts upcoming soonest first (undated last), past due most overdue first, completed most recent first', () => {
    const items = build({
      assignments: [
        assignment({ id: 'undated', title: 'Undated' }),
        assignment({ id: 'nov24', title: 'Nov 24 2pm', due_at: '2026-11-24T14:00:00Z' }),
        assignment({ id: 'old1', title: 'Old 1', due_at: '2026-10-01T12:00:00Z' }),
        assignment({ id: 'old2', title: 'Old 2', due_at: '2026-11-01T12:00:00Z' }),
        assignment({ id: 'done1', title: 'Done 1', due_at: '2026-10-05T12:00:00Z', status: 'graded' }),
        assignment({ id: 'done2', title: 'Done 2', due_at: '2026-11-05T12:00:00Z', status: 'submitted' }),
        assignment({ id: 'doneUndated', title: 'Done undated', status: 'graded' }),
      ],
      keyDates: [keyDate({ id: 'nov24day', due_on: '2026-11-24' }), keyDate({ id: 'nov13', due_on: '2026-11-13' })],
    })
    const lists = workLists(items, NOW)
    expect(keys(lists.upcoming)).toEqual(['kd:nov13', 'bba:nov24', 'kd:nov24day', 'bba:undated'])
    expect(keys(lists.pastDue)).toEqual(['bba:old1', 'bba:old2'])
    expect(keys(lists.completed)).toEqual(['bba:done2', 'bba:done1', 'bba:doneUndated'])
  })

  it('places lecture prep exactly as assignmentLists does', () => {
    const sessions = [
      session({ start: '2026-11-12T09:00:00Z' }), // under way at NOW: upcoming
      session({ start: '2026-11-12T08:00:00Z', end: '2026-11-12T09:00:00Z' }), // ended, not handed in
      session({ start: '2026-11-11T08:00:00Z', prepDone: true, status: 'green' }),
      session({ start: '2026-11-20T08:00:00Z', prepDone: true, status: 'green' }), // handed in early
      session({ start: '2026-11-19T08:00:00Z', status: 'amber' }),
    ]
    const lists = workLists(build({ sessions }), NOW)
    const expected = assignmentLists(sessions, NOW)
    const uids = (items: WorkItem[]) => items.map((i) => i.session?.uid)
    expect(uids(lists.upcoming)).toEqual(expected.upcoming.map((s) => s.uid))
    expect(uids(lists.pastDue)).toEqual(expected.pastDue.map((s) => s.uid))
    expect(uids(lists.completed)).toEqual(expected.completed.map((s) => s.uid))
  })
})

describe('applyWorkFilter', () => {
  const items = build({
    assignments: [
      assignment({ id: 'f', title: 'Formative Essay', course_id: 'c1081' }),
      assignment({ id: 's', title: 'Summative Essay', course_id: 'c1061' }),
      assignment({ id: 'q', title: 'Recognising Plagiarism Quiz', course_id: 'corg' }),
    ],
    sessions: [session({ start: '2026-11-13T10:00:00Z' })],
  })

  it('passes everything with all/all', () => {
    expect(applyWorkFilter(items, { categories: 'all', modules: 'all' })).toHaveLength(4)
  })

  it('filters by category', () => {
    expect(keys(applyWorkFilter(items, { categories: ['summative', 'test'], modules: 'all' }))).toEqual(['bba:s', 'bba:q'])
    expect(applyWorkFilter(items, { categories: ['lecture_prep'], modules: 'all' }).map((i) => i.category)).toEqual([
      'lecture_prep',
    ])
    expect(applyWorkFilter(items, { categories: [], modules: 'all' })).toEqual([])
  })

  it('filters by module; org-course items only show under all modules', () => {
    const geog1081 = applyWorkFilter(items, { categories: 'all', modules: ['GEOG1081'] })
    expect(geog1081.map((i) => i.moduleCode)).toEqual(['GEOG1081', 'GEOG1081'])
    expect(keys(applyWorkFilter(items, { categories: ['formative', 'summative'], modules: ['GEOG1061'] }))).toEqual(['bba:s'])
  })
})

describe('dueWithin', () => {
  it('lists undone, dated items due in the next 7 London days, soonest first', () => {
    const items = build({
      assignments: [
        assignment({ id: 'laterToday', title: 'Later today', due_at: '2026-11-12T16:00:00Z' }),
        assignment({ id: 'earlierToday', title: 'Earlier today', due_at: '2026-11-12T09:00:00Z' }), // already late
        assignment({ id: 'day7', title: 'Day 7', due_at: '2026-11-18T14:00:00Z' }),
        assignment({ id: 'day8', title: 'Day 8', due_at: '2026-11-19T09:00:00Z' }),
        assignment({ id: 'yesterday', title: 'Yesterday', due_at: '2026-11-11T09:00:00Z' }),
        assignment({ id: 'done', title: 'Done', due_at: '2026-11-13T09:00:00Z', status: 'submitted' }),
        assignment({ id: 'undated', title: 'Undated' }),
      ],
      keyDates: [keyDate({ id: 'tomorrow', due_on: '2026-11-13' })],
    })
    expect(keys(dueWithin(items, NOW, 7))).toEqual(['bba:laterToday', 'kd:tomorrow', 'bba:day7'])
  })
})

describe('syncStatus', () => {
  const run = (id: string, finished_at: string, ok: boolean): SyncRun => ({
    id,
    started_at: finished_at,
    finished_at,
    trigger: 'daily',
    ok,
    counts: ok ? { content: 210 } : {},
    error: ok ? null : 'login_required',
  })

  it('never synced', () => {
    expect(syncStatus([], NOW)).toEqual({ state: 'never', lastOkAt: null, counts: null, lastRun: null })
  })

  it('fresh within 48 hours, stale after', () => {
    expect(syncStatus([run('a', '2026-11-10T10:00:01Z', true)], NOW).state).toBe('fresh')
    const stale = syncStatus([run('a', '2026-11-10T09:59:59Z', true)], NOW)
    expect(stale).toMatchObject({ state: 'stale', lastOkAt: '2026-11-10T09:59:59Z', counts: { content: 210 } })
  })

  it('failed when the latest run failed, keeping the last success', () => {
    const status = syncStatus([run('ok', '2026-11-12T08:00:00Z', true), run('bad', '2026-11-12T09:00:00Z', false)], NOW)
    expect(status).toMatchObject({ state: 'failed', lastOkAt: '2026-11-12T08:00:00Z', lastRun: { id: 'bad' } })
    expect(syncStatus([run('bad', '2026-11-12T09:00:00Z', false)], NOW)).toMatchObject({ state: 'failed', lastOkAt: null })
  })
})
