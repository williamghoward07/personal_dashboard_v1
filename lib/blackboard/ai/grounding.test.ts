import { describe, expect, it } from 'vitest'
import {
  academicWindow,
  groundItems,
  keyDateFingerprint,
  linkToAssignment,
  mergeKeyDates,
  numbersDiffer,
  properNounsDiffer,
  sameTitle,
  titleSimilarity,
  titleTokens,
  toDueAt,
  validDueDate,
  type ExistingKeyDate,
  type FoundKeyDate,
} from './grounding'
import type { ModuleSession } from './sessions'

const C = 'course-1'

const Y = { yearStart: 2026 }

describe('groundItems', () => {
  const sources = [
    {
      title: 'Formative Essay',
      text: 'Hello all,\n\nThe formative   essay is due\n  24th November 2026 by 2pm via Turnitin.\nThanks for coming on 5 October.',
    },
    { title: 'Details of Week 6 tutorials now posted on LU', text: '' },
  ]

  it('keeps a verbatim quote, even across collapsed whitespace and case', () => {
    const { kept, ungrounded } = groundItems(
      [
        { source: 1, quote: 'The Formative Essay is due 24th November 2026 by 2pm', due_on: '2026-11-24' },
        { source: 2, quote: 'Details of Week 6 tutorials', due_on: '2026-11-17' },
      ],
      [sources[0], { ...sources[1], anchor: '2026-11-10' }],
      Y
    )
    expect(kept).toHaveLength(2)
    expect(ungrounded).toBe(0)
  })

  it('accepts typographic quote/dash differences but drops paraphrases', () => {
    const { kept, ungrounded } = groundItems(
      [
        { source: 1, quote: 'Submit the formative essay by 24 November at 2pm', due_on: '2026-11-24' },
        { source: 1, quote: 'essay due 24th Nov', due_on: '2026-11-24' },
      ],
      sources,
      Y
    )
    expect(kept).toHaveLength(0)
    expect(ungrounded).toBe(2)
    const curly = groundItems([{ source: 1, quote: 'Due 3 Dec – via Turnitin', due_on: '2026-12-03' }], [{ title: 'x', text: 'Due 3 Dec - via Turnitin. Thanks' }], Y)
    expect(curly.kept).toHaveLength(1)
  })

  it('drops short quotes, quotes from the wrong source and quotes with no date of their own', () => {
    const { kept, ungrounded } = groundItems(
      [
        { source: 1, quote: 'is due', due_on: '2026-11-24' },
        { source: 2, quote: 'The formative essay is due 24th November', due_on: '2026-11-24' },
        { source: 9, quote: 'anything at all', due_on: '2026-11-24' },
        // A date sitting next to the quote is no longer enough.
        { source: 1, quote: 'via Turnitin', due_on: '2026-11-24' },
      ],
      sources,
      Y
    )
    expect(kept).toHaveLength(0)
    expect(ungrounded).toBe(4)
  })

  // Finding 1: the model's date must be the one its quote states.
  it('drops an item whose date differs from the date in its quote', () => {
    const src = [{ title: 'Summative Essay due 16th February 2027 by 2pm', text: 'Submit via Turnitin.' }]
    const r = groundItems(
      [
        { source: 1, quote: 'Summative Essay due 16th February 2027', due_on: '2027-02-15' },
        { source: 1, quote: 'Submit via Turnitin', due_on: '2026-12-01' },
        { source: 1, quote: 'Summative Essay due 16th February 2027', due_on: '2027-02-16' },
      ],
      src,
      Y
    )
    expect(r.kept.map((k) => k.due_on)).toEqual(['2027-02-16'])
    expect(r.dateMismatch).toBe(1)
    expect(r.ungrounded).toBe(1)
  })

  it('accepts any date in a quote with several, and a day inside a written range', () => {
    const src = [{ title: 'Update', text: 'Posted 10 November: presentations run 2-6 November; logs due in the week beginning 9 November.' }]
    const r = groundItems(
      [
        { source: 1, quote: 'presentations run 2-6 November', due_on: '2026-11-04' },
        { source: 1, quote: 'presentations run 2-6 November', due_on: '2026-11-07' },
        { source: 1, quote: 'logs due in the week beginning 9 November', due_on: '2026-11-13' },
        { source: 1, quote: 'logs due in the week beginning 9 November', due_on: '2026-11-16' },
      ],
      src,
      Y
    )
    expect(r.kept.map((k) => k.due_on)).toEqual(['2026-11-04', '2026-11-13'])
    expect(r.dateMismatch).toBe(2)
  })

  it("never lets one source's text steer the date of another source's item", () => {
    const src = [
      { title: 'Essay', text: 'The essay is due 24 November.' },
      { title: 'Quiz', text: 'The quiz is on 1 December.' },
    ]
    const r = groundItems(
      [
        // Source 2's item quoting source 1's sentence: not in its own source.
        { source: 2, quote: 'The essay is due 24 November', due_on: '2026-11-24' },
        // Source 1's item carrying source 2's date.
        { source: 1, quote: 'The essay is due 24 November', due_on: '2026-12-01' },
      ],
      src,
      Y
    )
    expect(r.kept).toEqual([])
    expect(r).toMatchObject({ ungrounded: 1, dateMismatch: 1 })
  })

  it('accepts a relative-only date only from a source with a posted day, within 21 days, on the named weekday', () => {
    const text = "Please read chapter 2 before Tuesday's tutorial. Bring notes next week."
    const ann = { title: 'Reading', text, anchor: '2026-11-10T09:00:00Z' }
    const r = groundItems(
      [
        { source: 1, quote: "read chapter 2 before Tuesday's tutorial", due_on: '2026-11-17' },
        { source: 1, quote: "read chapter 2 before Tuesday's tutorial", due_on: '2026-11-19' }, // a Thursday
        { source: 1, quote: 'Bring notes next week', due_on: '2026-12-08' }, // 28 days on
        { source: 1, quote: 'Bring notes next week', due_on: '2026-11-18' },
        { source: 2, quote: "read chapter 2 before Tuesday's tutorial", due_on: '2026-11-17' },
      ],
      [ann, { title: 'Reading', text }],
      Y
    )
    expect(r.kept.map((k) => [k.source, k.due_on])).toEqual([
      [1, '2026-11-17'],
      [1, '2026-11-18'],
    ])
    expect(r).toMatchObject({ dateMismatch: 2, noAnchor: 1, ungrounded: 0 })
  })

  it('keeps due_time only when the quote states that time', () => {
    const src = [{ title: 'Essay', text: 'The essay is due 24 November 2026 by 2pm. The plan is due 20 November. Logs by 16.00 on 27 November.' }]
    const r = groundItems(
      [
        { source: 1, quote: 'The essay is due 24 November 2026 by 2pm', due_on: '2026-11-24', due_time: '14:00' },
        { source: 1, quote: 'The essay is due 24 November 2026 by 2pm', due_on: '2026-11-24', due_time: '15:00' },
        { source: 1, quote: 'The plan is due 20 November', due_on: '2026-11-20', due_time: '23:59' },
        { source: 1, quote: 'Logs by 16.00 on 27 November', due_on: '2026-11-27', due_time: '16:00' },
      ],
      src,
      Y
    )
    expect(r.kept.map((k) => k.due_time)).toEqual(['14:00', null, null, '16:00'])
  })
})

describe('groundItems with the module timetable', () => {
  // Tue 3 Nov 2026 posted; "next week" is Mon 9 - Sun 15 Nov.
  const POSTED = '2026-11-03T10:00:00Z'
  const sessions: ModuleSession[] = [
    { date: '2026-11-02', type: 'lecture' },
    { date: '2026-11-05', type: 'tutorial' },
    { date: '2026-11-09', type: 'lecture' },
    { date: '2026-11-12', type: 'tutorial' },
    { date: '2026-11-16', type: 'lecture' },
    { date: '2026-11-19', type: 'tutorial' },
  ]
  const ground = (text: string, dueOn: string[], opts: { sessions?: ModuleSession[]; anchor?: string | null; quote?: string } = {}) =>
    groundItems(
      dueOn.map((due_on) => ({ source: 1, quote: opts.quote ?? text, due_on })),
      [{ title: 'Announcement', text, anchor: opts.anchor === undefined ? POSTED : opts.anchor }],
      { ...Y, sessions: opts.sessions ?? sessions }
    )

  it('puts relative tutorial prep on the tutorial of the week the quote names', () => {
    const text = 'The tutorials take place next week and you will need to do some prep work ahead.'
    // Thu 12 Nov is the tutorial next week. Monday 9th, this week's tutorial
    // (5th) and a day 0-21 days on that is no tutorial are all dropped.
    const r = ground(text, ['2026-11-12', '2026-11-09', '2026-11-05', '2026-11-13'])
    expect(r.kept.map((k) => k.due_on)).toEqual(['2026-11-12'])
    expect(r.dateMismatch).toBe(3)
  })

  it('needs a session of the named kind inside a written week range when one exists', () => {
    const text = 'Details of the tutorials in the week beginning 9 November, with reading required in advance, are now posted.'
    const r = ground(text, ['2026-11-12', '2026-11-09', '2026-11-16'])
    // The tutorial day; the right week's wrong day and a day outside the range are dropped.
    expect(r.kept.map((k) => k.due_on)).toEqual(['2026-11-12'])
    expect(r.dateMismatch).toBe(2)
    // No tutorial in that week: any day of the range, as before.
    const none = ground(text, ['2026-11-09', '2026-11-11'], { sessions: sessions.filter((s) => s.date !== '2026-11-12') })
    expect(none.kept.map((k) => k.due_on)).toEqual(['2026-11-09', '2026-11-11'])
  })

  it('narrows any written range of up to a week, and leaves a quote naming no session as it was', () => {
    const days = ground('Tutorials run 2-6 November: bring your annotated map.', ['2026-11-05', '2026-11-03'])
    expect(days.kept.map((k) => k.due_on)).toEqual(['2026-11-05'])
    const noKind = ground('Logs are due in the week beginning 9 November.', ['2026-11-09', '2026-11-13'])
    expect(noKind.kept).toHaveLength(2)
  })

  it('lets a single written date win over the timetable', () => {
    const text = 'Please read chapter 3 before the tutorial on 11 November.'
    const r = ground(text, ['2026-11-11', '2026-11-12'])
    expect(r.kept.map((k) => k.due_on)).toEqual(['2026-11-11'])
    expect(r.dateMismatch).toBe(1)
  })

  it('takes only the next session of the named kind for "the next tutorial"', () => {
    const text = 'Read the case study before the next tutorial.'
    const r = ground(text, ['2026-11-05', '2026-11-12'])
    expect(r.kept.map((k) => k.due_on)).toEqual(['2026-11-05'])
    // Over a break the next tutorial may be more than 21 days on.
    const late = [{ date: '2026-12-10', type: 'tutorial' as const }, { date: '2027-01-14', type: 'tutorial' as const }]
    const r2 = ground(text, ['2027-01-14', '2026-12-28'], { sessions: late, anchor: '2026-12-11' })
    expect(r2.kept.map((k) => k.due_on)).toEqual(['2027-01-14'])
    expect(r2.dateMismatch).toBe(1)
  })

  it('keeps the weekday the quote names', () => {
    // The student's tutorial is on Thursday; "Tuesday's tutorial" is another group's.
    const r = ground("Read chapter 2 before Tuesday's tutorial.", ['2026-11-10', '2026-11-12'])
    expect(r.kept.map((k) => k.due_on)).toEqual(['2026-11-10'])
  })

  it('falls back to the old rule when the list has no session of the named kind', () => {
    const r = ground('Prepare a short summary for the seminar next week.', ['2026-11-09', '2026-11-11'])
    expect(r.kept.map((k) => k.due_on)).toEqual(['2026-11-09', '2026-11-11'])
  })

  it('also accepts the next session day for a relative quote naming no session', () => {
    const text = 'Next week there are 3 essential readings, all short.'
    // Old rule: anything 0-21 days on.
    expect(ground(text, ['2026-11-09', '2026-11-10']).kept).toHaveLength(2)
    // The next session after the posted day, even past 21 days (a break).
    const late = [{ date: '2027-01-11', type: 'lecture' as const }, { date: '2027-01-18', type: 'lecture' as const }]
    const r = ground(text, ['2027-01-11', '2027-01-18'], { sessions: late, anchor: '2026-12-11' })
    expect(r.kept.map((k) => k.due_on)).toEqual(['2027-01-11'])
    // Not when the quote names a weekday.
    const friday = ground('Read the essential readings by next Friday.', ['2027-01-11'], { sessions: late, anchor: '2026-12-11' })
    expect(friday.kept).toHaveLength(0)
  })

  it('still needs a posted day for a relative date', () => {
    const r = ground('The tutorials take place next week; prep is needed.', ['2026-11-12'], { anchor: null })
    expect(r).toMatchObject({ kept: [], noAnchor: 1 })
  })

  it('behaves exactly as before with no sessions known', () => {
    const text = 'The tutorials take place next week and you will need to do some prep work ahead.'
    const r = ground(text, ['2026-11-12', '2026-11-09', '2026-11-05', '2026-12-01'], { sessions: [] })
    expect(r.kept.map((k) => k.due_on)).toEqual(['2026-11-12', '2026-11-09', '2026-11-05'])
    const range = ground('Details of the tutorials in the week beginning 9 November.', ['2026-11-09', '2026-11-16'], { sessions: [] })
    expect(range.kept.map((k) => k.due_on)).toEqual(['2026-11-09'])
  })
})

describe('dates', () => {
  it('builds the academic window from the term year, else from today', () => {
    expect(academicWindow('2026', '2026-11-12')).toEqual({ from: '2026-08-01', to: '2027-09-30' })
    expect(academicWindow(null, '2027-03-01')).toEqual({ from: '2026-08-01', to: '2027-09-30' })
    expect(academicWindow('junk', '2026-09-01')).toEqual({ from: '2026-08-01', to: '2027-09-30' })
  })

  it('accepts only real dates inside the window', () => {
    const w = { from: '2026-08-01', to: '2027-09-30' }
    expect(validDueDate('2027-02-16', w)).toBe(true)
    expect(validDueDate('2026-07-31', w)).toBe(false)
    expect(validDueDate('2027-10-01', w)).toBe(false)
    expect(validDueDate('2027-02-29', w)).toBe(false)
    expect(validDueDate('2026-11-31', w)).toBe(false)
    expect(validDueDate('16 Feb', w)).toBe(false)
  })

  it('turns London wall time into UTC', () => {
    expect(toDueAt('2027-02-16', '14:00')).toBe('2027-02-16T14:00:00.000Z') // GMT
    expect(toDueAt('2026-10-05', '10:00')).toBe('2026-10-05T09:00:00.000Z') // BST
    expect(toDueAt('2026-10-05', null)).toBeNull()
    expect(toDueAt('2026-10-05', '25:00')).toBeNull()
  })

  // Finding 8: the offset is read at the target instant, not at midnight.
  it('is right on both clock-change Sundays', () => {
    // BST ends 01:00 UTC on 25 Oct 2026: 14:00 that afternoon is GMT.
    expect(toDueAt('2026-10-25', '14:00')).toBe('2026-10-25T14:00:00.000Z')
    expect(toDueAt('2026-10-25', '00:30')).toBe('2026-10-24T23:30:00.000Z') // still BST
    // BST starts 01:00 UTC on 28 Mar 2027: 14:00 that afternoon is BST.
    expect(toDueAt('2027-03-28', '14:00')).toBe('2027-03-28T13:00:00.000Z')
    expect(toDueAt('2027-03-28', '00:30')).toBe('2027-03-28T00:30:00.000Z') // still GMT
    // Ordinary days either side.
    expect(toDueAt('2026-07-01', '09:00')).toBe('2026-07-01T08:00:00.000Z')
    expect(toDueAt('2026-12-01', '09:00')).toBe('2026-12-01T09:00:00.000Z')
  })
})

describe('title tokens and fingerprints', () => {
  it('drops whole date / time phrases and stop-words', () => {
    expect([...titleTokens('Summative Essay due 16th February 2027 by 2pm (CMP002/ESFN41)')].sort()).toEqual([
      'cmp002',
      'esfn41',
      'essay',
      'summative',
    ])
    expect([...titleTokens('Formative Discussion Posts Due 11 December')].sort()).toEqual(['discussion', 'formative', 'post'])
  })

  // Finding 3: numbers, roman numerals and years are what tell items apart.
  it('keeps numbers, years and roman numerals, as digits', () => {
    expect([...titleTokens('Read Smith (2020) for tutorial')].sort()).toEqual(['2020', 'read', 'smith', 'tutorial'])
    expect([...titleTokens('Read chapter 3 for tutorial')].sort()).toEqual(['3', 'chapter', 'read', 'tutorial'])
    expect([...titleTokens('Formative Discussion Post II')].sort()).toEqual(['2', 'discussion', 'formative', 'post'])
    expect(titleTokens('Formative Discussion Post I')).toEqual(titleTokens('Formative discussion post 1'))
    expect(keyDateFingerprint({ course_id: C, due_on: '2026-12-11', title: 'Read chapter 3 for tutorial' })).not.toBe(
      keyDateFingerprint({ course_id: C, due_on: '2026-12-11', title: 'Read chapter 4 for tutorial' })
    )
  })

  it('gives a reworded title on the same day the same fingerprint', () => {
    const a = keyDateFingerprint({ course_id: C, due_on: '2026-12-11', title: 'Submit formative discussion posts' })
    const b = keyDateFingerprint({ course_id: C, due_on: '2026-12-11', title: 'Formative discussion post due' })
    const otherDay = keyDateFingerprint({ course_id: C, due_on: '2026-12-12', title: 'Formative discussion post' })
    const otherCourse = keyDateFingerprint({ course_id: 'c2', due_on: '2026-12-11', title: 'Formative discussion post' })
    expect(a).toBe(b)
    expect(a).not.toBe(otherDay)
    expect(a).not.toBe(otherCourse)
    expect(a).toMatch(/^[0-9a-f]{32}$/)
  })

  it('scores similarity on token sets', () => {
    expect(titleSimilarity('Submit formative essay', 'Formative essay')).toBeCloseTo(1)
    expect(titleSimilarity('Formative essay', 'Summative essay')).toBeLessThan(0.5)
    expect(titleSimilarity('', 'anything')).toBe(0)
  })

  it('tells differing numbers and names apart', () => {
    expect(numbersDiffer('Read chapter 3', 'Read chapter 4')).toBe(true)
    expect(numbersDiffer('Post I', 'Post 1')).toBe(false)
    expect(properNounsDiffer('Read Smith for tutorial', 'Read Jones for tutorial')).toBe(true)
    expect(properNounsDiffer('Submit formative essay', 'Formative essay')).toBe(false)
    expect(sameTitle('Submit formative discussion posts', 'Formative discussion post')).toBe(true)
    expect(sameTitle('Submit formative essay', 'Submit formative essay plan')).toBe(false)
  })
})

describe('linkToAssignment', () => {
  const assignments = [
    { id: 'as-1', course_id: C, title: 'Summative Essay due 16th February 2027 by 2pm (CMP002/ESFN41)', due_at: '2027-02-16T14:00:00Z' },
    { id: 'as-2', course_id: C, title: 'Fieldwork report', due_at: '2027-03-10T12:00:00Z' },
  ]

  it('links by same London day and a similar title', () => {
    expect(linkToAssignment({ course_id: C, due_on: '2027-02-16', title: 'Submit summative essay' }, assignments)).toBe('as-1')
    expect(linkToAssignment({ course_id: C, due_on: '2027-02-17', title: 'Submit summative essay' }, assignments)).toBeNull()
    expect(linkToAssignment({ course_id: 'c2', due_on: '2027-02-16', title: 'Submit summative essay' }, assignments)).toBeNull()
    expect(linkToAssignment({ course_id: C, due_on: '2027-02-16', title: 'Bring wellies' }, assignments)).toBeNull()
  })

  it("honours the model's match only when the dates agree", () => {
    expect(linkToAssignment({ course_id: C, due_on: '2027-03-10', title: 'Hand in the report', matches_assignment: 2 }, assignments)).toBe('as-2')
    expect(linkToAssignment({ course_id: C, due_on: '2027-03-11', title: 'Hand in it', matches_assignment: 2 }, assignments)).toBeNull()
    expect(linkToAssignment({ course_id: C, due_on: '2027-03-10', title: 'x', matches_assignment: 9 }, assignments)).toBeNull()
  })
})

// ------------------------------------------------------------------ merge --

function found(title: string, due_on: string, over: Partial<FoundKeyDate> = {}): FoundKeyDate {
  return {
    course_id: C,
    title,
    category: 'formative',
    due_on,
    due_at: null,
    for_session_type: null,
    for_week: null,
    quote: `${title} ${due_on}`,
    assignment_id: null,
    fingerprint: keyDateFingerprint({ course_id: C, due_on, title }),
    ...over,
  }
}

function existing(id: string, f: FoundKeyDate, over: Partial<ExistingKeyDate> = {}): ExistingKeyDate {
  return {
    id,
    course_id: f.course_id,
    announcement_id: null,
    content_id: null,
    document_id: null,
    title: f.title,
    category: f.category,
    due_on: f.due_on,
    ai_due_on: f.due_on,
    due_at: f.due_at,
    for_session_type: f.for_session_type,
    for_week: f.for_week,
    quote: f.quote,
    status: 'suggested',
    assignment_id: f.assignment_id,
    fingerprint: f.fingerprint,
    ...over,
  }
}

const ANN = { kind: 'announcement' as const, id: 'ann-1' }

describe('mergeKeyDates', () => {
  it('inserts new items with exactly one source id set', () => {
    const m = mergeKeyDates([], [found('Submit formative essay', '2026-11-24')], ANN)
    expect(m.update).toEqual([])
    expect(m.remove).toEqual([])
    expect(m.insert).toHaveLength(1)
    expect(m.insert[0]).toMatchObject({ announcement_id: 'ann-1', content_id: null, document_id: null, status: 'suggested', ai_due_on: '2026-11-24' })
  })

  it('leaves an unchanged own row alone', () => {
    const f = found('Submit formative essay', '2026-11-24')
    expect(mergeKeyDates([existing('k1', f, { announcement_id: 'ann-1' })], [f], ANN)).toEqual({ insert: [], update: [], remove: [] })
  })

  it('never resurrects a dismissed row, with the same or a reworded title', () => {
    const f = found('Submit formative essay', '2026-11-24')
    const dismissed = existing('k1', f, { announcement_id: 'ann-1', status: 'dismissed' })
    expect(mergeKeyDates([dismissed], [f], ANN)).toEqual({ insert: [], update: [], remove: [] })
    const reworded = found('Formative essay submission (Turnitin)', '2026-11-24', { quote: 'other quote' })
    expect(reworded.fingerprint).not.toBe(f.fingerprint)
    expect(mergeKeyDates([dismissed], [reworded], ANN)).toEqual({ insert: [], update: [], remove: [] })
    // Dismissed from another source counts when it's the same quote or fingerprint.
    const otherSource = existing('k2', f, { content_id: 'ct-1', status: 'dismissed' })
    expect(mergeKeyDates([otherSource], [{ ...reworded, quote: f.quote }], ANN).insert).toEqual([])
    expect(mergeKeyDates([otherSource], [found('Formative essay due', '2026-11-24', { quote: 'x' })], ANN).insert).toEqual([])
    // And a dismissed row that isn't found again stays (it's the memory).
    expect(mergeKeyDates([dismissed], [], ANN).remove).toEqual([])
  })

  // Finding 4: a reworded title from the same source is still the dismissed item.
  it('keeps a dismissed date dismissed when its own source is re-read with a reworded title', () => {
    const quote = 'The formative essay is due 24 November 2026 by 2pm'
    const dismissed = existing('k1', found('Submit formative essay', '2026-11-24', { quote }), { content_id: 'ct-1', status: 'dismissed' })
    const ct = { kind: 'content' as const, id: 'ct-1' }
    // Same quote, title with nothing in common but "formative".
    const reworded = found('Hand in formative coursework', '2026-11-24', { quote })
    expect(titleSimilarity(reworded.title, dismissed.title)).toBeLessThan(0.5)
    expect(mergeKeyDates([dismissed], [reworded], ct)).toEqual({ insert: [], update: [], remove: [] })
    // The quote now only contains (or is contained by) the old one.
    const longer = found('Hand in formative coursework', '2026-11-24', { quote: `Reminder: ${quote} via Turnitin` })
    expect(mergeKeyDates([dismissed], [longer], ct)).toEqual({ insert: [], update: [], remove: [] })
    // Different quote, similar title, no differing number.
    const similar = found('Submit formative essay (Turnitin)', '2026-11-24', { quote: 'Essays are due on 24 November' })
    expect(mergeKeyDates([dismissed], [similar], ct)).toEqual({ insert: [], update: [], remove: [] })
    // A suggested row is updated in place instead.
    const suggested = { ...dismissed, status: 'suggested' as const }
    const m = mergeKeyDates([suggested], [reworded], ct)
    expect(m.insert).toEqual([])
    expect(m.remove).toEqual([])
    expect(m.update).toEqual([{ id: 'k1', patch: expect.objectContaining({ title: 'Hand in formative coursework' }) }])
    // A dismissed row on another day doesn't block.
    expect(mergeKeyDates([dismissed], [{ ...reworded, due_on: '2026-11-25' }], ct).insert).toHaveLength(1)
  })

  it('blocks a cross-source insert only on the same quote or fingerprint', () => {
    const f = found('Submit formative essay', '2026-11-24', { quote: 'Formative essay due 24 November' })
    const confirmed = existing('k1', f, { content_id: 'ct-1', status: 'confirmed' })
    expect(mergeKeyDates([confirmed], [found('Hand in coursework', '2026-11-24', { quote: f.quote })], ANN).insert).toEqual([])
    expect(mergeKeyDates([confirmed], [found('Formative essay due', '2026-11-24', { quote: 'other' })], ANN).insert).toEqual([])
    // A different item on the same day from another source is not blocked.
    expect(mergeKeyDates([confirmed], [found('Bring fieldwork notebook', '2026-11-24')], ANN).insert).toHaveLength(1)
  })

  it('never changes or removes a confirmed row, even one whose date I edited', () => {
    const f = found('Submit formative essay', '2026-11-24')
    const confirmed = existing('k1', f, { announcement_id: 'ann-1', status: 'confirmed', due_on: '2026-11-25', ai_due_on: '2026-11-24', title: 'My essay' })
    const changed = found('Submit formative essay', '2026-11-24', { category: 'summative', quote: 'new quote' })
    expect(mergeKeyDates([confirmed], [changed], ANN)).toEqual({ insert: [], update: [], remove: [] })
    expect(mergeKeyDates([confirmed], [], ANN)).toEqual({ insert: [], update: [], remove: [] })
  })

  it('updates a suggested row when its details or date change, keeping ai_due_on in step', () => {
    const f = found('Submit formative essay', '2026-11-24')
    const row = existing('k1', f, { announcement_id: 'ann-1' })
    const timed = found('Submit formative essay', '2026-11-24', { due_at: '2026-11-24T14:00:00.000Z', category: 'summative' })
    expect(mergeKeyDates([row], [timed], ANN)).toEqual({
      insert: [],
      update: [{ id: 'k1', patch: { due_at: '2026-11-24T14:00:00.000Z', category: 'summative' } }],
      remove: [],
    })
    const moved = found('Submit formative essay', '2026-11-26')
    const m = mergeKeyDates([row], [moved], ANN)
    expect(m.insert).toEqual([])
    expect(m.remove).toEqual([])
    expect(m.update).toHaveLength(1)
    expect(m.update[0].patch).toMatchObject({ due_on: '2026-11-26', ai_due_on: '2026-11-26', fingerprint: moved.fingerprint })
  })

  it('removes stale suggested rows of its own source only', () => {
    const a = existing('own', found('Read chapter 2 for tutorial', '2026-11-20'), { announcement_id: 'ann-1' })
    const b = existing('other-ann', found('Bring fieldwork notebook', '2026-11-21'), { announcement_id: 'ann-2' })
    const c = existing('content', found('Discussion post', '2026-11-13'), { content_id: 'ct-1' })
    expect(mergeKeyDates([a, b, c], [], ANN)).toEqual({ insert: [], update: [], remove: ['own'] })
  })

  it('collapses the same deadline from an announcement and an item title into one', () => {
    const fromAnnouncement = existing('k1', found('Submit formative discussion post', '2026-11-13'), { announcement_id: 'ann-1' })
    const fromTitle = found('Formative discussion posts', '2026-11-13', { quote: 'Formative Discussion Post I, due 13 November' })
    const m = mergeKeyDates([fromAnnouncement], [fromTitle], { kind: 'content', id: 'ct-1' })
    expect(m).toEqual({ insert: [], update: [], remove: [] })
    // Within one pass too.
    const twice = mergeKeyDates([], [found('Formative discussion post', '2026-11-13'), found('Submit formative discussion posts', '2026-11-13')], ANN)
    expect(twice.insert).toHaveLength(1)
    // Unsure (only 0.75 similar): kept apart, a duplicate rather than a loss.
    const looser = existing('k2', found('Post formative discussion contribution', '2026-11-13'), { announcement_id: 'ann-1' })
    expect(mergeKeyDates([looser], [fromTitle], { kind: 'content', id: 'ct-1' }).insert).toHaveLength(1)
  })

  it('keeps different deadlines on the same day apart', () => {
    const m = mergeKeyDates([], [found('Formative essay', '2026-11-24'), found('Summative essay', '2026-11-24')], ANN)
    expect(m.insert).toHaveLength(2)
  })

  // Finding 3: each confirmed pair used to collapse into one row.
  it.each([
    ['Read Smith (2020) for tutorial', 'Read Jones (2019) for tutorial', 'tutorial'],
    ['GIS practical test', 'Statistics practical test', 'test'],
    ['Read chapter 3 for tutorial', 'Read chapter 4 for tutorial', 'tutorial'],
    ['Submit formative essay', 'Submit formative essay plan', 'formative'],
    ['Formative Discussion Post I', 'Formative Discussion Post II', 'formative'],
  ] as const)('keeps "%s" and "%s" on the same day as two rows', (a, b, category) => {
    const day = '2026-11-24'
    const fa = found(a, day, { category })
    const fb = found(b, day, { category })
    // Within one pass.
    expect(mergeKeyDates([], [fa, fb], ANN).insert).toHaveLength(2)
    // Against a row from the same source, any status.
    for (const status of ['suggested', 'confirmed', 'dismissed'] as const) {
      const m = mergeKeyDates([existing('k1', fa, { announcement_id: 'ann-1', status })], [fa, fb], ANN)
      expect(m.insert.map((i) => i.title)).toEqual([b])
      expect(m.remove).toEqual([])
    }
    // Against a row from another source.
    expect(mergeKeyDates([existing('k1', fa, { content_id: 'ct-1' })], [fb], ANN).insert).toHaveLength(1)
  })

  it('never removes or moves rows that `keep` protects', () => {
    const doc = { kind: 'document' as const, id: 'doc-1' }
    const early = existing('k1', found('Submit fieldwork report', '2026-11-20'), { document_id: 'doc-1' })
    expect(mergeKeyDates([early], [], doc, { keep: () => true }).remove).toEqual([])
    // Not moved onto a similar item found on another day either.
    const m = mergeKeyDates([early], [found('Submit fieldwork report draft', '2027-01-20')], doc, { keep: (r) => r.id === 'k1' })
    expect(m.update).toEqual([])
    expect(m.insert).toHaveLength(1)
    expect(mergeKeyDates([early], [], doc).remove).toEqual(['k1'])
  })
})
