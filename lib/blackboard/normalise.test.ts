import { describe, expect, it } from 'vitest'
import { BB_ORIGIN, type BbCourseSnapshot, type BbSnapshot } from './client'
import { contentKind, htmlToText, normaliseSnapshot, parseSyncBody, parseWeekLabel, toIso } from './normalise'

function course(overrides: Partial<BbCourseSnapshot> = {}): BbCourseSnapshot {
  return {
    bbId: '_100_1',
    courseCode: 'GEOG1241_2026',
    moduleCode: 'GEOG1241',
    name: 'Rivers &amp; Floods',
    membership: {},
    course: {},
    columns: [],
    grades: [],
    announcements: [],
    contents: [],
    skippedFolders: 0,
    errors: [],
    ...overrides,
  }
}

function snap(overrides: Partial<BbSnapshot> = {}): BbSnapshot {
  return {
    version: 1,
    origin: BB_ORIGIN,
    fetchedAt: '2026-11-09T10:00:00.000Z',
    user: { id: '_9_1', userName: 'abcd12' },
    courses: [course()],
    todo: [
      { since: '2026-10-26T10:00:00.000Z', until: '2026-11-09T10:00:00.000Z', body: {} },
      { since: '2026-11-09T10:00:00.000Z', until: '2026-11-23T10:00:00.000Z', body: {} },
    ],
    errors: [],
    requestCount: 10,
    durationMs: 1000,
    ...overrides,
  }
}

describe('htmlToText', () => {
  it('keeps paragraph breaks and decodes entities', () => {
    expect(htmlToText('<p>Hello&nbsp;<b>class</b>,</p><p>Fish &amp; chips&#39; &#x263A;</p>')).toBe(
      "Hello class,\nFish & chips' ☺",
    )
  })
  it('drops scripts, styles and comments, and turns list items into bullets', () => {
    expect(htmlToText('<style>p{}</style><!-- x --><ul><li>One</li><li>Two</li></ul><script>alert(1)</script>')).toBe(
      '• One\n• Two',
    )
  })
  it('collapses whitespace and blank lines', () => {
    expect(htmlToText('  a   b <br><br><br><br> c ')).toBe('a b\n\nc')
  })
})

describe('parseWeekLabel', () => {
  it('reads Week N in its common spellings', () => {
    expect(parseWeekLabel('Week 5')).toBe(5)
    expect(parseWeekLabel('Wk 12 – rivers')).toBe(12)
    expect(parseWeekLabel('Lecture slides (week 3)')).toBe(3)
    expect(parseWeekLabel('Weeks 3 & 4')).toBe(3)
  })
  it('ignores titles without a week', () => {
    expect(parseWeekLabel('Weekly reading')).toBeNull()
    expect(parseWeekLabel('Assessment 2026')).toBeNull()
  })
})

describe('toIso', () => {
  it('normalises valid timestamps and rejects junk', () => {
    expect(toIso('2026-11-20T12:00:00Z')).toBe('2026-11-20T12:00:00.000Z')
    expect(toIso('not a date')).toBeNull()
    expect(toIso(123)).toBeNull()
    expect(toIso('')).toBeNull()
  })
})

describe('contentKind', () => {
  it('maps content handlers', () => {
    expect(contentKind({ contentHandler: { id: 'resource/x-bb-folder' } })).toBe('folder')
    expect(contentKind({ contentHandler: { id: 'resource/x-bb-externallink' } })).toBe('link')
    expect(contentKind({ contentHandler: { id: 'resource/x-bb-asmt-test-link' } })).toBe('assignment')
    expect(contentKind({ contentHandler: { id: 'resource/x-something-new' } })).toBe('other')
    expect(contentKind({})).toBe('other')
  })
})

describe('normaliseSnapshot', () => {
  it('maps courses, using parseCourseCode for the module code', () => {
    const rows = normaliseSnapshot(snap({ courses: [course(), course({ bbId: '_200_1', courseCode: 'X_SCI_2026', moduleCode: null, name: 'Science' })] }))
    expect(rows.courses).toEqual([
      {
        bb_id: '_100_1',
        course_code: 'GEOG1241_2026',
        module_code: 'GEOG1241',
        name: 'Rivers & Floods',
        term: '2026',
        url: `${BB_ORIGIN}/ultra/courses/_100_1/outline`,
      },
      expect.objectContaining({ bb_id: '_200_1', module_code: null }),
    ])
  })

  it('maps content with kind, path, week label (own title or nearest folder) and an absolute link', () => {
    const rows = normaliseSnapshot(
      snap({
        courses: [
          course({
            contents: [
              { id: '_1_1', depth: 0, path: [], title: 'Week 5', contentHandler: { id: 'resource/x-bb-folder' } },
              {
                id: '_2_1',
                depth: 1,
                path: ['Week 5'],
                parentId: '_1_1',
                title: 'Lecture slides',
                contentHandler: { id: 'resource/x-bb-file' },
                availability: { adaptiveRelease: { start: '2026-11-03T09:00:00Z' } },
                links: [{ href: '/ultra/courses/_100_1/outline/file/_2_1', rel: 'alternate', type: 'text/html' }],
              },
              {
                id: '_3_1',
                depth: 2,
                path: ['Week 5', 'Week 6 preview'],
                parentId: '_9_1',
                title: 'Reading',
                links: [{ href: 'https://evil.example/x' }],
              },
            ],
          }),
        ],
      }),
    )
    expect(rows.content).toEqual([
      expect.objectContaining({ bb_id: '_1_1', kind: 'folder', week_label: 5, parent_bb_id: null, path: [] }),
      {
        bb_id: '_2_1',
        course_bb_id: '_100_1',
        parent_bb_id: '_1_1',
        title: 'Lecture slides',
        kind: 'file',
        available_from: '2026-11-03T09:00:00.000Z',
        path: ['Week 5'],
        week_label: 5,
        url: `${BB_ORIGIN}/ultra/courses/_100_1/outline/file/_2_1`,
      },
      // The nearest folder wins, and off-Blackboard links fall back to the course page.
      expect.objectContaining({ bb_id: '_3_1', week_label: 6, kind: 'other', url: `${BB_ORIGIN}/ultra/courses/_100_1/outline` }),
    ])
  })

  it('strips HTML from announcement bodies', () => {
    const rows = normaliseSnapshot(
      snap({
        courses: [
          course({
            announcements: [
              { id: '_a_1', title: 'Field trip', body: '<p>Bring <b>boots</b>.</p><p>Thanks</p>', created: '2026-11-01T08:00:00Z' },
              { id: '_a_2', title: 'Rich', body: { displayText: '<div>Hi&amp;bye</div>' }, availability: { duration: { start: '2026-11-02T08:00:00Z' } } },
              { title: 'No id, skipped' },
            ],
          }),
        ],
      }),
    )
    expect(rows.announcements).toEqual([
      {
        bb_id: '_a_1',
        course_bb_id: '_100_1',
        title: 'Field trip',
        body_text: 'Bring boots.\nThanks',
        posted_at: '2026-11-01T08:00:00.000Z',
        url: `${BB_ORIGIN}/ultra/courses/_100_1/announcements`,
      },
      expect.objectContaining({ bb_id: '_a_2', body_text: 'Hi&bye', posted_at: '2026-11-02T08:00:00.000Z' }),
    ])
  })

  it('maps grades with score, possible, display grade and plain-text feedback', () => {
    const rows = normaliseSnapshot(
      snap({
        courses: [
          course({
            columns: [{ id: '_c_1', name: 'Essay', score: { possible: 100 } }],
            grades: [
              { columnId: '_c_1', status: 'Graded', displayGrade: { scaleType: 'Score', score: 68 }, feedback: '<p>Good work</p>', lastRelevantDate: '2026-11-05T12:00:00Z' },
              { columnId: '_c_2', displayGrade: { scaleType: 'Percent', score: 72, possible: 100 } },
              { columnId: '_c_3', displayGrade: { scaleType: 'Text', text: 'Pass' } },
            ],
          }),
        ],
      }),
    )
    expect(rows.grades).toEqual([
      {
        bb_id: '_c_1',
        course_bb_id: '_100_1',
        score: 68,
        possible: 100,
        display_grade: '68/100',
        feedback: 'Good work',
        released_at: '2026-11-05T12:00:00.000Z',
      },
      expect.objectContaining({ bb_id: '_c_2', display_grade: '72%' }),
      expect.objectContaining({ bb_id: '_c_3', score: null, display_grade: 'Pass' }),
    ])
  })

  it('merges To Do items with coursework columns, keyed by todoItemKey', () => {
    const rows = normaliseSnapshot(
      snap({
        courses: [
          course({
            columns: [
              { id: '_c_1', name: 'Essay (column)', contentId: '_x_1', grading: { type: 'Attempts', due: '2026-11-20T12:00:00Z' } },
              { id: '_c_2', name: 'Old quiz', contentId: '_x_2', grading: { type: 'Attempts', due: '2026-09-01T12:00:00Z' } },
              { id: '_c_tot', name: 'Total', grading: { type: 'Calculated' } },
              { id: '_c_manual', name: 'Participation', grading: { type: 'Manual' } },
            ],
            grades: [
              { columnId: '_c_1', status: 'NeedsGrading' },
              { columnId: '_c_2', status: 'Graded', displayGrade: { score: 9 } },
            ],
            contents: [{ id: '_x_1', depth: 0, path: [], title: 'Essay', links: [{ href: '/ultra/courses/_100_1/outline/assessment/_x_1/overview', type: 'text/html' }] }],
          }),
        ],
        todo: [
          {
            since: '2026-10-26T10:00:00.000Z',
            until: '2026-11-09T10:00:00.000Z',
            body: {},
          },
          {
            since: '2026-11-09T10:00:00.000Z',
            until: '2026-11-23T10:00:00.000Z',
            body: {
              futureDueItems: [
                { title: 'Essay', dueDate: '2026-11-21T12:00:00Z', column: { id: '_c_1', contentId: '_x_1', courseId: '_100_1' } },
                // Turnitin: only in the To Do feed, matched by course code, keyed by content id.
                { title: 'Turnitin report', dueDate: '2026-11-22T12:00:00Z', column: { contentId: '_t_1', courseId: 'GEOG1241_2026' } },
                { title: 'Other course', dueDate: '2026-11-22T12:00:00Z', column: { id: '_z_1', courseId: '_999_1' } },
              ],
            },
          },
          {
            // Windows overlap at their edges: the same item twice is one row.
            since: '2026-11-22T10:00:00.000Z',
            until: '2026-11-23T10:00:00.000Z',
            body: { dueTodayItems: [{ title: 'Turnitin report', dueDate: '2026-11-22T12:00:00Z', column: { contentId: '_t_1', courseId: 'GEOG1241_2026' } }] },
          },
        ],
      }),
    )
    expect(rows.assignments).toEqual([
      {
        bb_id: 'column:_c_1',
        course_bb_id: '_100_1',
        title: 'Essay',
        due_at: '2026-11-21T12:00:00.000Z', // To Do wins for due dates
        bb_content_id: '_x_1',
        status: 'submitted',
        url: `${BB_ORIGIN}/ultra/courses/_100_1/outline/assessment/_x_1/overview`,
      },
      expect.objectContaining({ bb_id: 'column:_c_2', title: 'Old quiz', status: 'graded', due_at: '2026-09-01T12:00:00.000Z' }),
      expect.objectContaining({ bb_id: 'content:_t_1', title: 'Turnitin report', status: 'not_submitted', url: `${BB_ORIGIN}/ultra/courses/_100_1/outline` }),
    ])
    expect(rows.skipped.assignments).toBe(1)
  })

  it('scopes removal to sections that were read cleanly', () => {
    const rows = normaliseSnapshot(
      snap({
        courses: [
          course(),
          course({ bbId: '_200_1', courseCode: 'GEOG2001_2026', errors: ['columns: Blackboard returned 500 for /x', 'contents _5_1: Blackboard returned 500 for /y'] }),
          course({ bbId: '_300_1', courseCode: 'GEOG3001_2026', skippedFolders: 2, errors: ['announcements: boom'] }),
        ],
      }),
    )
    expect(rows.scopes).toEqual({
      assignments: ['_100_1', '_300_1'],
      assignment_window: { since: '2026-10-26T10:00:00.000Z', until: '2026-11-23T10:00:00.000Z' },
      grades: ['_100_1', '_200_1', '_300_1'],
      announcements: ['_100_1', '_200_1'],
      content: ['_100_1'],
    })
    expect(rows.errors).toEqual([
      'GEOG2001_2026 columns: Blackboard returned 500 for /x',
      'GEOG2001_2026 contents _5_1: Blackboard returned 500 for /y',
      'GEOG3001_2026 announcements: boom',
    ])
  })

  it('never removes assignments when a To Do window failed', () => {
    const rows = normaliseSnapshot(snap({ errors: ['todo 2026-11-09T10:00:00.000Z: Blackboard returned 400'] }))
    expect(rows.scopes.assignments).toEqual([])
    expect(rows.scopes.assignment_window).toBeNull()
  })

  it('is deterministic, so a re-sync sends identical rows', () => {
    const s = snap({ courses: [course({ announcements: [{ id: '_a_1', title: 'Hi', body: '<p>x</p>' }] })] })
    expect(normaliseSnapshot(s)).toEqual(normaliseSnapshot(s))
  })
})

describe('parseSyncBody', () => {
  it('accepts a snapshot with an optional trigger', () => {
    expect(parseSyncBody({ snapshot: snap() })?.trigger).toBe('manual')
    expect(parseSyncBody({ trigger: 'daily', snapshot: snap() })?.trigger).toBe('daily')
  })
  it('rejects bad triggers, foreign origins and malformed courses', () => {
    expect(parseSyncBody(null)).toBeNull()
    expect(parseSyncBody({ snapshot: snap(), trigger: 'cron' })).toBeNull()
    expect(parseSyncBody({ snapshot: snap({ origin: 'https://evil.example' }) })).toBeNull()
    expect(parseSyncBody({ snapshot: { ...snap(), version: 2 } })).toBeNull()
    expect(parseSyncBody({ snapshot: snap({ courses: [{ ...course(), contents: [{ id: 1 }] } as unknown as BbCourseSnapshot] }) })).toBeNull()
    expect(parseSyncBody({ snapshot: snap({ courses: [{ ...course(), bbId: '' }] }) })).toBeNull()
    expect(parseSyncBody({ snapshot: snap({ todo: [{ since: 'x', until: 'y', body: {} }] }) })).toBeNull()
  })
})
