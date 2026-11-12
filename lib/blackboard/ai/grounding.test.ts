import { describe, expect, it } from 'vitest'
import {
  academicWindow,
  groundItems,
  keyDateFingerprint,
  linkToAssignment,
  mergeKeyDates,
  titleSimilarity,
  titleTokens,
  toDueAt,
  validDueDate,
  type ExistingKeyDate,
  type FoundKeyDate,
} from './grounding'

const C = 'course-1'

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
        { source: 1, quote: 'The Formative Essay is due 24th November 2026 by 2pm' },
        { source: 2, quote: 'Details of Week 6 tutorials' },
      ],
      sources
    )
    expect(kept).toHaveLength(2)
    expect(ungrounded).toBe(0)
  })

  it('accepts typographic quote/dash differences but drops paraphrases', () => {
    const { kept, ungrounded } = groundItems(
      [
        { source: 1, quote: 'Submit the formative essay by 24 November at 2pm' },
        { source: 1, quote: 'essay due 24th Nov' },
      ],
      sources
    )
    expect(kept).toHaveLength(0)
    expect(ungrounded).toBe(2)
    const curly = groundItems([{ source: 1, quote: 'Turnitin. Thanks for coming' }], [{ title: 'x', text: 'Due 3 Dec via Turnitin. Thanks for coming' }])
    expect(curly.kept).toHaveLength(1)
  })

  it('drops short quotes, quotes from the wrong source and quotes with no date nearby', () => {
    const far = { title: 'Notes', text: `Due 1 December.${' filler'.repeat(60)} Remember the sticky notes.` }
    const { kept, ungrounded } = groundItems(
      [
        { source: 1, quote: 'is due' },
        { source: 2, quote: 'The formative essay is due' },
        { source: 3, quote: 'Remember the sticky notes' },
        { source: 9, quote: 'anything at all' },
      ],
      [...sources, far]
    )
    expect(kept).toHaveLength(0)
    expect(ungrounded).toBe(4)
  })

  it('keeps a quote without a date of its own when a date sits within 200 characters', () => {
    const { kept } = groundItems(
      [{ source: 1, quote: 'via Turnitin' }],
      [{ title: 'Essay', text: 'The formative essay is due 24th November 2026 by 2pm via Turnitin.' }]
    )
    expect(kept).toHaveLength(1)
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
})

describe('title tokens and fingerprints', () => {
  it('drops dates, times, ordinals and stop-words', () => {
    expect([...titleTokens('Summative Essay due 16th February 2027 by 2pm (CMP002/ESFN41)')].sort()).toEqual([
      'cmp002',
      'esfn41',
      'essay',
      'summative',
    ])
    expect([...titleTokens('Formative Discussion Posts Due 11 December')].sort()).toEqual(['discussion', 'formative', 'post'])
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
    // Dismissed from another source counts too.
    const otherSource = existing('k2', f, { content_id: 'ct-1', status: 'dismissed' })
    expect(mergeKeyDates([otherSource], [reworded], ANN).insert).toEqual([])
    // And a dismissed row that isn't found again stays (it's the memory).
    expect(mergeKeyDates([dismissed], [], ANN).remove).toEqual([])
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
    const fromAnnouncement = existing('k1', found('Post formative discussion contribution', '2026-11-13'), { announcement_id: 'ann-1' })
    const fromTitle = found('Formative discussion post', '2026-11-13', { quote: 'Formative Discussion Post I, due 13 November' })
    const m = mergeKeyDates([fromAnnouncement], [fromTitle], { kind: 'content', id: 'ct-1' })
    expect(m).toEqual({ insert: [], update: [], remove: [] })
    // Within one pass too.
    const twice = mergeKeyDates([], [found('Formative discussion post', '2026-11-13'), found('Submit formative discussion posts', '2026-11-13')], ANN)
    expect(twice.insert).toHaveLength(1)
  })

  it('keeps different deadlines on the same day apart', () => {
    const m = mergeKeyDates([], [found('Formative essay', '2026-11-24'), found('Summative essay', '2026-11-24')], ANN)
    expect(m.insert).toHaveLength(2)
  })
})
