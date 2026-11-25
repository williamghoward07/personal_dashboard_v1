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
  it('takes the first university week of Durham ranges, without converting it', () => {
    expect(parseWeekLabel('Week 12: Introduction Lecture')).toBe(12)
    expect(parseWeekLabel('Weeks 13-15: Geographic Research (Methods)')).toBe(13)
    expect(parseWeekLabel('Weeks 18–19 Introduction to GIS')).toBe(18)
    expect(parseWeekLabel('Wk 7')).toBe(7)
    expect(parseWeekLabel('Wks 8-9')).toBe(8)
    expect(parseWeekLabel('Block 1: Climate')).toBeNull()
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
  it('maps the handlers seen on Durham Blackboard', () => {
    expect(contentKind({ contentHandler: { id: 'resource/x-bb-lesson', forcedSequence: false } })).toBe('lesson')
    expect(contentKind({ contentHandler: { id: 'resource/x-bb-file', file: { fileName: 'a.pptx' } } })).toBe('file')
    // LTI: a gradable link (e.g. Turnitin) is a submission point, else a tool.
    expect(contentKind({ contentHandler: { id: 'resource/x-bb-blti-link', url: 'https://x.example/lti', grading: { due: '2027-02-16T14:00:00Z' } } })).toBe('assignment')
    expect(contentKind({ contentHandler: { id: 'resource/x-bb-blti-link', url: 'https://api.turnitinuk.com/lti/1p3/launch' } })).toBe('assignment')
    expect(contentKind({ contentHandler: { id: 'resource/x-bb-blti-link', url: 'https://x.example/lti' } })).toBe('tool')
    expect(contentKind({ contentHandler: { id: 'resource/x-bb-bltiplacement-lti-talis-cnt-01', placementHandle: 'talis' } })).toBe('tool')
    expect(contentKind({ contentHandler: { id: 'resource/x-bb-bltiplacement-PanoptoApplication-1', placementHandle: 'p' } })).toBe('tool')
    expect(contentKind({ contentHandler: { id: 'resource/x-bb-courselink', targetId: '_1_1', targetType: 'Discussion' } })).toBe('discussion')
    expect(contentKind({ contentHandler: { id: 'resource/x-bb-courselink', targetId: '_1_1', targetType: 'Assessment' } })).toBe('assignment')
    expect(contentKind({ contentHandler: { id: 'resource/x-bb-courselink', targetId: '_1_1' } })).toBe('link')
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
        body_text: null,
        // An x-bb-file item links to itself, labelled by its title when it has no file name.
        links: [{ href: `${BB_ORIGIN}/ultra/courses/_100_1/outline/file/_2_1`, label: 'Lecture slides', kind: 'file' }],
      },
      // The nearest folder wins, and off-Blackboard links fall back to the course page.
      expect.objectContaining({ bb_id: '_3_1', week_label: 6, kind: 'other', url: `${BB_ORIGIN}/ultra/courses/_100_1/outline` }),
    ])
  })

  it('keeps item text and embedded links, never the raw item API links', () => {
    const itemUrl = `${BB_ORIGIN}/ultra/courses/_100_1/outline/edit/document/_d_1`
    const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    const bbfile = JSON.stringify({
      fileName: 'Essay brief.docx',
      linkName: 'Essay brief',
      mimeType: docx,
      resourceUrl: `${BB_ORIGIN}/sessions/1/2/Essay%20brief.docx?X-Blackboard-Signature=abc`,
    }).replace(/"/g, '&quot;')
    const rows = normaliseSnapshot(
      snap({
        courses: [
          course({
            contents: [
              {
                id: '_d_1',
                depth: 0,
                path: [],
                title: 'Week 12: Introduction',
                contentHandler: { id: 'resource/x-bb-document' },
                description: '<p>Read before Monday.</p>',
                body:
                  '<p>Read before Monday.</p><p>See the <a href="https://rl.talis.com/3/durham/lists/AB12.html">Talis Aspire reading list</a>.</p>' +
                  `<p><a href="${BB_ORIGIN}/sessions/1/2/x" data-bbfile="${bbfile}">Essay brief</a></p>`,
                links: [{ href: '/ultra/courses/_100_1/outline/edit/document/_d_1', rel: 'alternate', type: 'text/html' }],
              },
            ],
          }),
        ],
      }),
    )
    expect(rows.content[0]).toMatchObject({
      body_text: 'Read before Monday.\n\nRead before Monday.\nSee the Talis Aspire reading list.\nEssay brief',
      links: [
        { href: 'https://rl.talis.com/3/durham/lists/AB12.html', label: 'Talis Aspire reading list', kind: 'talis' },
        { href: itemUrl, label: 'Essay brief.docx', kind: 'file', mime: docx },
      ],
    })
    expect(JSON.stringify(rows.content[0].links)).not.toMatch(/sessions|Signature|rel/)
  })

  it('drops a description that repeats the body, and caps body text', () => {
    const rows = normaliseSnapshot(
      snap({
        courses: [
          course({
            contents: [
              { id: '_e_1', depth: 0, path: [], title: 'A', description: 'Same', body: '<p>Same</p>' },
              { id: '_e_2', depth: 0, path: [], title: 'B', body: 'x'.repeat(30_000) },
              { id: '_e_3', depth: 0, path: [], title: 'C', body: '<p> </p>', description: { displayText: '<b>Rich</b>' } },
            ],
          }),
        ],
      }),
    )
    expect(rows.content.map((r) => r.body_text?.length ?? null)).toEqual([4, 20_000, 4])
    expect(rows.content[2].body_text).toBe('Rich')
  })

  it('never puts NUL or half a surrogate pair into the payload', () => {
    // The 20,000th UTF-16 unit (index 19,999) is a high surrogate: a plain cut would end on it.
    const body = 'x'.repeat(19_999) + '\ud83d\ude00'
    expect(body).toHaveLength(20_001)
    const rows = normaliseSnapshot(
      snap({
        courses: [
          course({
            name: 'Rivers\u0000 & Floods',
            contents: [
              { id: '_z_1', depth: 1, path: ['Week\u0000 5', 'Bad &#xD800; folder'], title: 'Hand\u0000book', body },
              { id: '_z_2', depth: 0, path: [], title: 'File', contentHandler: { id: 'resource/x-bb-file', file: { fileName: 'Brief\u0000.pdf', mimeType: 'application/pdf\u0000' } } },
            ],
            announcements: [{ id: '_a_9', title: '\u0000', body: `<p>${'y'.repeat(19_999)}\ud83d\ude00</p>` }],
            grades: [{ columnId: '_c_9', displayGrade: { text: 'A\u0000' }, feedback: 'Well\u0000 done \udc00' }],
          }),
        ],
      }),
    )
    const [item, file] = rows.content
    expect(item.title).toBe('Handbook')
    expect(item.path).toEqual(['Week 5', 'Bad \ufffd folder'])
    expect(item.week_label).toBe(5)
    expect(item.body_text).toBe('x'.repeat(19_999))
    expect(file.links[0]).toMatchObject({ label: 'Brief.pdf', mime: 'application/pdf' })
    expect(rows.courses[0].name).toBe('Rivers & Floods')
    expect(rows.announcements[0]).toMatchObject({ title: 'Announcement', body_text: 'y'.repeat(19_999) })
    expect(rows.grades[0]).toMatchObject({ display_grade: 'A', feedback: 'Well done \ufffd' })
    // Well-formed throughout: no NUL and no lone surrogate anywhere.
    const json = JSON.stringify(rows)
    expect(JSON.parse(json)).toEqual(JSON.parse(JSON.stringify(rows)))
    const strings: string[] = []
    JSON.parse(json, (_k, v) => (typeof v === 'string' && strings.push(v), v))
    for (const str of strings) expect(str).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]|\u0000/)
    expect(rows.content[0].body_text!.length).toBeLessThanOrEqual(20_000)
    expect(json).not.toMatch(/\\u0000|\\ud[89ab][0-9a-f]{2}(?!\\ud[c-f])|(?<!\\ud[89ab][0-9a-f]{2})\\ud[c-f][0-9a-f]{2}/i)
  })

  it('adds the item\'s own target from its content handler', () => {
    const pptx = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    const outline = (id: string) => ({ links: [{ href: `/ultra/courses/_100_1/outline/file/${id}`, type: 'text/html' }] })
    const rows = normaliseSnapshot(
      snap({
        courses: [
          course({
            contents: [
              { id: '_s_1', depth: 1, path: ['Week 12'], title: 'Lecture 1 slides', contentHandler: { id: 'resource/x-bb-file', file: { fileName: 'L1 Intro.pptx', mimeType: pptx }, fileAssociationMode: 'Embed' }, ...outline('_s_1') },
              { id: '_s_2', depth: 0, path: [], title: 'Module handbook', contentHandler: { id: 'resource/x-bb-file', file: { fileName: 'Handbook.pdf', mimeType: 'application/pdf' } }, ...outline('_s_2') },
              { id: '_s_3', depth: 0, path: [], title: 'Data portal', contentHandler: { id: 'resource/x-bb-externallink', url: 'https://data.example.org/portal' } },
              { id: '_s_4', depth: 0, path: [], title: 'Link to Reading List in Talis Aspire', contentHandler: { id: 'resource/x-bb-bltiplacement-lti-talis-cnt-01', placementHandle: 'talis' }, ...outline('_s_4') },
              { id: '_s_5', depth: 0, path: [], title: 'Encore - Recordings Folder', contentHandler: { id: 'resource/x-bb-bltiplacement-PanoptoApplication-1', placementHandle: 'p' }, ...outline('_s_5') },
              { id: '_s_6', depth: 0, path: [], title: 'Summative Essay due 16th February 2027 by 2pm', contentHandler: { id: 'resource/x-bb-blti-link', url: 'https://lti.example/launch?token=1' } },
            ],
          }),
        ],
      }),
    )
    const links = Object.fromEntries(rows.content.map((r) => [r.bb_id, r.links]))
    expect(links._s_1).toEqual([{ href: `${BB_ORIGIN}/ultra/courses/_100_1/outline/file/_s_1`, label: 'L1 Intro.pptx', kind: 'slides', mime: pptx }])
    expect(links._s_2).toEqual([{ href: `${BB_ORIGIN}/ultra/courses/_100_1/outline/file/_s_2`, label: 'Handbook.pdf', kind: 'file', mime: 'application/pdf' }])
    expect(links._s_3).toEqual([{ href: 'https://data.example.org/portal', label: 'Data portal', kind: 'other' }])
    expect(links._s_4).toEqual([{ href: `${BB_ORIGIN}/ultra/courses/_100_1/outline/file/_s_4`, label: 'Link to Reading List in Talis Aspire', kind: 'talis' }])
    expect(links._s_5).toEqual([{ href: `${BB_ORIGIN}/ultra/courses/_100_1/outline/file/_s_5`, label: 'Encore - Recordings Folder', kind: 'panopto' }])
    // An LTI launch URL is never stored.
    expect(links._s_6).toEqual([])
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
        is_formative: null,
        url: `${BB_ORIGIN}/ultra/courses/_100_1/outline/assessment/_x_1/overview`,
      },
      expect.objectContaining({ bb_id: 'column:_c_2', title: 'Old quiz', status: 'graded', due_at: '2026-09-01T12:00:00.000Z' }),
      expect.objectContaining({ bb_id: 'content:_t_1', title: 'Turnitin report', status: 'not_submitted', url: `${BB_ORIGIN}/ultra/courses/_100_1/outline` }),
    ])
    expect(rows.skipped.assignments).toBe(1)
  })

  it('reads is_formative from the To Do item\'s column only when it is a boolean', () => {
    const item = (contentId: string, isFormative: unknown) => ({
      title: contentId,
      dueDate: '2026-11-13T12:00:00Z',
      column: { contentId, courseId: '_100_1', ...(isFormative === undefined ? {} : { isFormative }) },
    })
    const rows = normaliseSnapshot(
      snap({
        courses: [course({ columns: [{ id: '_c_9', name: 'Column only', contentId: '_k_9', grading: { due: '2026-12-01T12:00:00Z' } }] })],
        todo: [
          {
            since: '2026-11-09T10:00:00.000Z',
            until: '2026-11-23T10:00:00.000Z',
            body: { futureDueItems: [item('_k_1', true), item('_k_2', false), item('_k_3', undefined), item('_k_4', 'yes')] },
          },
        ],
      }),
    )
    expect(Object.fromEntries(rows.assignments.map((a) => [a.title, a.is_formative]))).toEqual({
      'Column only': null,
      _k_1: true,
      _k_2: false,
      _k_3: null,
      _k_4: null,
    })
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
    const s = snap({
      courses: [
        course({
          announcements: [{ id: '_a_1', title: 'Hi', body: '<p>x</p>' }],
          contents: [{ id: '_d_1', depth: 0, path: [], title: 'Doc', body: '<a href="https://rl.talis.com/3/durham/lists/X.html">List</a>' }],
        }),
      ],
    })
    expect(normaliseSnapshot(s)).toEqual(normaliseSnapshot(s))
  })
})

describe('Ultra Document bodies', () => {
  it("names an ultraDocumentBody child after its parent, and leaves a top-level one alone", () => {
    const rows = normaliseSnapshot(
      snap({
        courses: [
          course({
            contents: [
              { id: '_p_1', depth: 0, path: [], title: 'Climate Lecture 1: The Climate System', hasChildren: true },
              { id: '_b_1', depth: 1, path: ['Block 1: Climate', 'Climate Lecture 1: The Climate System'], title: 'ultraDocumentBody', body: '<p>Slides and reading</p>' },
              { id: '_b_2', depth: 0, path: [], title: 'ultraDocumentBody' },
            ],
          }),
        ],
      }),
    )
    const [, body, orphan] = rows.content
    expect(body.title).toBe('Climate Lecture 1: The Climate System')
    expect(body.path).toEqual(['Block 1: Climate', 'Climate Lecture 1: The Climate System'])
    expect(body.body_text).toBe('Slides and reading')
    expect(orphan.title).toBe('ultraDocumentBody')
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
