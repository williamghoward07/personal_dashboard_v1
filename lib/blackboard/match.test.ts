import { describe, expect, it } from 'vitest'
import type { SessionWithPrep, TimetableSession } from '@/lib/timetable/session'
import {
  buildCourseIndex,
  calibrateWeekOffset,
  defaultWeekOneStart,
  effectiveWeekOffset,
  matchSession,
  moduleReadingList,
  normaliseSessionType,
  resolveContentTarget,
  sessionOrdinals,
  universityWeekOf,
  type BbContentAiLite,
  type BbContentLite,
  type MatchContext,
} from './match'
import type { BbContentLink, BbKeyDate } from './types'

// Real shapes from the Durham audit (12 Nov 2026). University week 1 starts
// Mon 20 Jul 2026, so week 12 (the first teaching week) is Mon 5 Oct 2026.
const WEEK_ONE = '2026-07-20'

let seq = 0
function session(over: Partial<TimetableSession> & Pick<TimetableSession, 'start'>): TimetableSession {
  seq += 1
  const code = over.moduleCode ?? 'GEOG1081'
  const type = over.type ?? 'Lecture'
  return {
    uid: `uid-${seq}@mytimetable.durham.ac.uk`,
    title: `${code}: Module - ${type}`,
    moduleCode: code,
    moduleName: 'Module',
    type,
    end: null,
    location: 'ER201',
    ...over,
  }
}

function content(over: Partial<BbContentLite> & Pick<BbContentLite, 'id' | 'title'>): BbContentLite {
  return {
    bb_id: `_${over.id}_1`,
    course_id: 'course',
    parent_bb_id: null,
    kind: 'file',
    path: [],
    week_label: null,
    url: `https://blackboard.durham.ac.uk/ultra/courses/_1_1/outline/edit/document/_${over.id}_1`,
    links: [],
    removed_at: null,
    ...over,
  }
}

/** A child of `parent`, with its path and week label filled in like normalise.ts does. */
function child(parent: BbContentLite, over: Partial<BbContentLite> & Pick<BbContentLite, 'id' | 'title'>): BbContentLite {
  const path = [...parent.path, parent.title]
  return content({
    parent_bb_id: parent.bb_id,
    path,
    week_label: weekOf(over.title) ?? parent.week_label,
    course_id: parent.course_id,
    ...over,
  })
}

function weekOf(text: string): number | null {
  const m = /\b(?:weeks?|wks?)\.?\s*(\d{1,2})\b/i.exec(text)
  return m ? Number(m[1]) : null
}

const slides = (label: string): BbContentLink => ({
  href: `https://blackboard.durham.ac.uk/bbcswebdav/${encodeURIComponent(label)}`,
  label,
  kind: 'slides',
  mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
})

function ai(content_id: string, over: Partial<BbContentAiLite>): BbContentAiLite {
  return {
    content_id,
    role: 'other',
    uni_week: null,
    session_type: null,
    lecture_ordinal: null,
    explicit_date: null,
    read_with_ai: false,
    ...over,
  }
}

function keyDate(over: Partial<BbKeyDate> & Pick<BbKeyDate, 'id' | 'due_on'>): BbKeyDate {
  return {
    user_id: 'u',
    course_id: 'course',
    announcement_id: 'a1',
    content_id: null,
    document_id: null,
    title: 'Something due',
    category: 'session_task',
    due_at: null,
    ai_due_on: over.due_on,
    for_session_type: null,
    for_week: null,
    quote: 'quoted text',
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

function ctx(over: Partial<MatchContext> & Pick<MatchContext, 'contents'>): MatchContext {
  return {
    course: { id: 'course', week_offset: 0 },
    ai: new Map(),
    overrides: [],
    keyDates: [],
    weekOneStart: WEEK_ONE,
    ordinal: null,
    ...over,
  }
}

const titles = (items: { content: BbContentLite }[]) => items.map((i) => i.content.title)
const all = (m: ReturnType<typeof matchSession>) => [...m.slides, ...m.readings, ...m.recordings, ...m.other]

describe('university weeks', () => {
  it('derives week 1 from the first module session (Mon 5 Oct 2026 = week 12)', () => {
    const sessions = [
      session({ moduleCode: null, title: 'Welcome Talks: Welcome Talks', start: '2026-09-27T10:00:00Z' }),
      session({ start: '2026-10-07T09:00:00Z' }),
      session({ moduleCode: 'GEOG1222', start: '2026-10-05T09:00:00Z' }),
      session({ start: '2027-05-07T09:00:00Z', type: 'Test' }),
    ]
    expect(defaultWeekOneStart(sessions)).toBe(WEEK_ONE)
    expect(defaultWeekOneStart([])).toBeNull()
  })

  it('numbers London days by university week', () => {
    expect(universityWeekOf('2026-07-20', WEEK_ONE)).toBe(1)
    expect(universityWeekOf('2026-10-05', WEEK_ONE)).toBe(12)
    expect(universityWeekOf('2026-10-11', WEEK_ONE)).toBe(12)
    expect(universityWeekOf('2026-10-12', WEEK_ONE)).toBe(13)
    expect(universityWeekOf('2026-11-09', WEEK_ONE)).toBe(17)
  })
})

describe('calibrateWeekOffset', () => {
  const cal = { weekOneStart: WEEK_ONE, yearStart: 2026 }

  it('GEOG1061: teaching weeks written with their dates → 11', () => {
    const rows = [
      { title: 'BLOCK 1.1, DRB, Week 1 (5 October) - Conservation', week_label: 1 },
      { title: 'Week 2 (12 October)', week_label: 2 },
      { title: 'BLOCK 1.2, DRB, Week 5 (2 November)', week_label: 5 },
      { title: 'Lecture slides', week_label: 2 },
    ]
    expect(calibrateWeekOffset(rows, cal)).toBe(11)
  })

  it('GEOG1081: university week labels → 0', () => {
    const rows = [
      { title: 'Week 12: Introduction Lecture', week_label: 12 },
      { title: 'Weeks 13-15: Geographic Research', week_label: 13 },
      { title: 'Week 16: Quantitative Methods lect…', week_label: 16 },
      { title: 'Block 1: Climate', week_label: null },
    ]
    expect(calibrateWeekOffset(rows, cal)).toBe(0)
  })

  it('small undated labels look like teaching weeks → 11', () => {
    const rows = [1, 2, 3, 4].map((w) => ({ title: `Week ${w}`, week_label: w }))
    expect(calibrateWeekOffset(rows, cal)).toBe(11)
  })

  it('no labels at all → 0 (GEOG1071 block folders, GEOG1241 date titles)', () => {
    expect(calibrateWeekOffset([{ title: 'Block 1: Climate', week_label: null }], cal)).toBe(0)
    expect(
      calibrateWeekOffset([{ title: 'Monday, 9 November: Borders and Migration (Prof Lauren Martin)', week_label: null }], cal)
    ).toBe(0)
  })

  it('a deadline date next to a week label does not calibrate', () => {
    expect(calibrateWeekOffset([{ title: 'Week 14 essay due 24 November', week_label: 14 }], cal)).toBe(0)
  })

  it('a non-zero stored week_offset wins', () => {
    const rows = [{ title: 'Week 2 (12 October)', week_label: 2 }]
    expect(effectiveWeekOffset({ week_offset: 3 }, rows, cal)).toBe(3)
    expect(effectiveWeekOffset({ week_offset: 0 }, rows, cal)).toBe(11)
  })
})

describe('resolveContentTarget', () => {
  const t = { yearStart: 2026, weekOffset: 0 }

  it('trusts its own title date first', () => {
    const row = { title: 'Lecture 1 - Mon 5th Oct 2026, 10am, ER201', path: ['Week 13'], week_label: 13 }
    expect(resolveContentTarget(row, [{ title: 'Week 13' }], null, t)).toMatchObject({
      date: '2026-10-05',
      uniWeek: 13,
      ordinal: 1,
      ordinalType: 'lecture',
      sessionType: 'lecture',
      via: 'own',
    })
  })

  it('takes the nearest ancestor with a date, read from path when the parent rows are missing', () => {
    const row = { title: 'Slides.pptx', path: ['Teaching', '2-6 November: Workshop I - Crisis of Democracy', 'Materials'], week_label: null }
    expect(resolveContentTarget(row, [], null, t)).toMatchObject({
      date: '2026-11-02',
      endDate: '2026-11-06',
      sessionType: 'workshop',
      ordinal: 1,
      via: 'ancestor',
    })
  })

  it('falls back to AI, then reports nothing', () => {
    const row = { title: 'Climate slides', path: ['Block 1: Climate'], week_label: null }
    expect(resolveContentTarget(row, [], ai('x', { explicit_date: '2026-10-07' }), t)).toMatchObject({ date: '2026-10-07', via: 'ai' })
    expect(resolveContentTarget(row, [], ai('x', { uni_week: 2 }), { yearStart: 2026, weekOffset: 11 })).toMatchObject({
      uniWeek: 13,
      via: 'ai',
    })
    expect(resolveContentTarget(row, [], null, t)).toEqual({ via: null })
  })

  it('reads week ranges', () => {
    const row = { title: 'Reading list', path: ['Weeks 13-15: Geographic Research'], week_label: 13 }
    expect(resolveContentTarget(row, [], null, t)).toMatchObject({ uniWeek: 13, uniWeekEnd: 15, via: 'ancestor' })
  })

  it('ignores deadline dates', () => {
    const row = { title: 'Summative Essay due 16th February 2027 by 2pm (CMP002/ESFN41)', path: [], week_label: null }
    expect(resolveContentTarget(row, [], null, t).date).toBeUndefined()
  })

  it('an ambiguous title stops the type search', () => {
    const row = { title: 'Lecture and tutorial readings', path: ['Week 12: Introduction Lecture'], week_label: 12 }
    expect(resolveContentTarget(row, [], null, t).sessionType).toBeUndefined()
  })
})

describe('sessionOrdinals', () => {
  it('counts per module and per type in date order', () => {
    const l2 = session({ moduleCode: 'GEOG1222', start: '2026-10-12T09:00:00Z' })
    const l1 = session({ moduleCode: 'GEOG1222', start: '2026-10-05T09:00:00Z' })
    const t1 = session({ moduleCode: 'GEOG1222', type: 'Tutorial', start: '2026-10-08T09:00:00Z' })
    const w1 = session({ moduleCode: 'GEOG1222', type: 'Online Workshop', start: '2026-10-09T09:00:00Z' })
    const w2 = session({ moduleCode: 'GEOG1222', type: 'Workshop', start: '2026-10-16T09:00:00Z' })
    const other = session({ moduleCode: 'GEOG1081', start: '2026-10-06T09:00:00Z' })
    const uncoded = session({ moduleCode: null, start: '2026-10-01T09:00:00Z' })
    const ord = sessionOrdinals([l2, l1, t1, w1, w2, other, uncoded])
    expect(ord.get(l1.uid)).toBe(1)
    expect(ord.get(l2.uid)).toBe(2)
    expect(ord.get(t1.uid)).toBe(1)
    expect(ord.get(w1.uid)).toBe(1)
    expect(ord.get(w2.uid)).toBe(2)
    expect(ord.get(other.uid)).toBe(1)
    expect(ord.has(uncoded.uid)).toBe(false)
  })

  it('normalises session types', () => {
    expect(normaliseSessionType('Online Workshop')).toBe('workshop')
    expect(normaliseSessionType('Lectures')).toBe('lecture')
    expect(normaliseSessionType('Field trip')).toBe('fieldwork')
    expect(normaliseSessionType('Additional Class')).toBe('additional class')
    expect(normaliseSessionType('')).toBeNull()
  })
})

describe('matchSession: GEOG1241 (dates in titles)', () => {
  const lesson = content({
    id: 'l9',
    kind: 'lesson',
    title: 'Monday, 9 November: Borders and Migration (Prof Lauren Martin)',
    links: [slides('Borders and Migration.pptx')],
  })
  const workshop = content({ id: 'w1', kind: 'folder', title: '2-6 November: Workshop I - Crisis of Democracy' })
  const workshopBrief = child(workshop, { id: 'w1b', kind: 'document', title: 'Workshop brief' })
  const crises = content({ id: 'wc', kind: 'folder', title: '30 November-4 December: Workshop on Border Crises' })
  const crisesSlides = child(crises, { id: 'wcs', title: 'Border crises', links: [slides('Border crises.pptx')] })
  const rows = [lesson, workshop, workshopBrief, crises, crisesSlides]

  it('a date-titled lesson with no children matches the Monday 9 Nov lecture', () => {
    const m = matchSession(session({ moduleCode: 'GEOG1241', start: '2026-11-09T10:00:00Z' }), ctx({ contents: rows }))
    expect(titles(m.slides)).toEqual([lesson.title])
    expect(m.slides[0]).toMatchObject({ confidence: 'date', role: 'slides', label: 'Borders and Migration.pptx' })
    expect(m.other).toEqual([])
  })

  it('does not match the following week', () => {
    const m = matchSession(session({ moduleCode: 'GEOG1241', start: '2026-11-16T10:00:00Z' }), ctx({ contents: rows }))
    expect(all(m)).toEqual([])
  })

  it('a dated lesson with children lists its children, not itself', () => {
    const slidesFile = child(lesson, { id: 'l9s', title: 'Lecture slides', links: [slides('Week 17.pptx')] })
    const m = matchSession(
      session({ moduleCode: 'GEOG1241', start: '2026-11-09T10:00:00Z' }),
      ctx({ contents: [lesson, slidesFile] })
    )
    expect(titles(all(m))).toEqual(['Lecture slides'])
    expect(m.slides[0].confidence).toBe('date')
  })

  it('a workshop date range matches a workshop inside it, never a lecture that week', () => {
    const ws = matchSession(session({ moduleCode: 'GEOG1241', type: 'Workshop', start: '2026-11-04T14:00:00Z' }), ctx({ contents: rows }))
    expect(titles(all(ws))).toEqual(['Workshop brief'])
    expect(ws.other[0].confidence).toBe('date')

    const lecture = matchSession(session({ moduleCode: 'GEOG1241', start: '2026-11-04T10:00:00Z' }), ctx({ contents: rows }))
    expect(all(lecture)).toEqual([])
  })

  it('a cross-month range covers 2 December', () => {
    const m = matchSession(session({ moduleCode: 'GEOG1241', type: 'Workshop', start: '2026-12-02T14:00:00Z' }), ctx({ contents: rows }))
    expect(titles(m.slides)).toEqual(['Border crises'])
  })
})

describe('matchSession: GEOG1061 (teaching weeks with dates)', () => {
  const week1 = content({ id: 'f1', kind: 'folder', title: 'BLOCK 1.1, DRB, Week 1 (5 October) - Conservation', week_label: 1 })
  const week2 = content({ id: 'f2', kind: 'folder', title: 'Week 2 (12 October)', week_label: 2 })
  const pptx = child(week2, { id: 'p2', title: 'Lecture 2 slides', links: [slides('GEOG1061 Lecture 2.pptx')] })
  const reading = child(week2, {
    id: 'r2',
    kind: 'document',
    title: 'Readings for this week',
    links: [{ href: 'https://rl.talis.com/3/durham/lists/ABC.html', label: 'Talis Aspire reading list', kind: 'talis' }],
  })
  const rows = [week1, week2, pptx, reading]

  it("calibrates offset 11 and matches the child pptx to the 12 Oct lecture by date", () => {
    const m = matchSession(session({ moduleCode: 'GEOG1061', start: '2026-10-12T09:00:00Z' }), ctx({ contents: rows }))
    expect(m.weekOffset).toBe(11)
    expect(m.uniWeek).toBe(13)
    expect(titles(m.slides)).toEqual(['Lecture 2 slides'])
    expect(m.slides[0]).toMatchObject({ confidence: 'date', href: pptx.links[0].href })
    expect(titles(m.readings)).toEqual(['Readings for this week'])
    expect(m.readings[0].href).toBe('https://rl.talis.com/3/durham/lists/ABC.html')
  })

  it('a second session that week gets the same items by week', () => {
    const m = matchSession(session({ moduleCode: 'GEOG1061', start: '2026-10-14T13:00:00Z' }), ctx({ contents: rows }))
    expect(titles(m.slides)).toEqual(['Lecture 2 slides'])
    expect(m.slides[0].confidence).toBe('week')
  })

  it('nothing from week 2 shows on week 3', () => {
    const m = matchSession(session({ moduleCode: 'GEOG1061', start: '2026-10-19T09:00:00Z' }), ctx({ contents: rows }))
    expect(all(m)).toEqual([])
  })

  it('folders themselves are never listed', () => {
    const m = matchSession(session({ moduleCode: 'GEOG1061', start: '2026-10-05T09:00:00Z' }), ctx({ contents: rows }))
    expect(all(m)).toEqual([])
  })
})

describe('matchSession: GEOG1081 (university weeks)', () => {
  const intro = content({ id: 'i12', kind: 'lesson', title: 'Week 12: Introduction Lecture', week_label: 12 })
  const introSlides = child(intro, { id: 'i12s', title: 'Introduction', links: [slides('Intro.pptx')] })
  const tutorialSheet = content({ id: 't12', kind: 'document', title: 'Week 12 tutorial worksheet', week_label: 12 })
  const research = content({ id: 'g13', kind: 'folder', title: 'Weeks 13-15: Geographic Research', week_label: 13 })
  const researchDoc = child(research, { id: 'g13d', kind: 'document', title: 'Research design notes' })
  const rows = [intro, introSlides, tutorialSheet, research, researchDoc]

  it('Week 12 matches the lecture in the week of 5 Oct with offset 0', () => {
    const m = matchSession(session({ start: '2026-10-05T10:00:00Z' }), ctx({ contents: rows }))
    expect(m.weekOffset).toBe(0)
    expect(titles(m.slides)).toEqual(['Introduction'])
    expect(m.slides[0].confidence).toBe('week')
  })

  it('a tutorial-typed item does not appear on a lecture in the same week, but does on the tutorial', () => {
    const lecture = matchSession(session({ start: '2026-10-05T10:00:00Z' }), ctx({ contents: rows }))
    expect(titles(all(lecture))).not.toContain('Week 12 tutorial worksheet')

    const tutorial = matchSession(session({ type: 'Tutorial', start: '2026-10-08T10:00:00Z' }), ctx({ contents: rows }))
    expect(titles(all(tutorial))).toEqual(['Week 12 tutorial worksheet'])
  })

  it('a Weeks 13-15 folder covers weeks 13, 14 and 15 only', () => {
    const on = (start: string) => titles(all(matchSession(session({ start }), ctx({ contents: rows }))))
    expect(on('2026-10-12T10:00:00Z')).toEqual(['Research design notes'])
    expect(on('2026-10-26T11:00:00Z')).toEqual(['Research design notes'])
    expect(on('2026-11-02T11:00:00Z')).toEqual([])
  })
})

describe('matchSession: GEOG1222 (lecture number and date)', () => {
  const l1 = content({ id: 'g1', title: 'Lecture 1 - Mon 5th Oct 2026, 10am, ER201', links: [slides('L1.pptx')] })

  it('matches the 5 Oct lecture by date', () => {
    const m = matchSession(session({ moduleCode: 'GEOG1222', start: '2026-10-05T09:00:00Z' }), ctx({ contents: [l1], ordinal: 1 }))
    expect(m.slides[0]).toMatchObject({ confidence: 'date' })
  })

  it('still finds lecture 1 by its number when the session moved', () => {
    const m = matchSession(session({ moduleCode: 'GEOG1222', start: '2026-10-06T09:00:00Z' }), ctx({ contents: [l1], ordinal: 1 }))
    expect(m.slides[0]).toMatchObject({ confidence: 'ordinal' })
    const second = matchSession(session({ moduleCode: 'GEOG1222', start: '2026-10-12T09:00:00Z' }), ctx({ contents: [l1], ordinal: 2 }))
    expect(all(second)).toEqual([])
  })

  it('a lecture number never matches a tutorial with the same ordinal', () => {
    const m = matchSession(
      session({ moduleCode: 'GEOG1222', type: 'Tutorial', start: '2026-10-08T09:00:00Z' }),
      ctx({ contents: [l1], ordinal: 1 })
    )
    expect(all(m)).toEqual([])
  })
})

describe('matchSession: GEOG1071 block folders (no week, no date)', () => {
  const block = content({ id: 'b1', kind: 'folder', title: 'Block 1: Climate' })
  const climate = child(block, { id: 'b1s', title: 'Climate systems', links: [slides('Climate systems.pptx')] })
  const rows = [block, climate]
  const lecture = (start: string) => session({ moduleCode: 'GEOG1071', start })

  it('matches nothing without AI', () => {
    for (const start of ['2026-10-05T09:00:00Z', '2026-10-12T09:00:00Z', '2026-10-19T09:00:00Z']) {
      expect(all(matchSession(lecture(start), ctx({ contents: rows, ordinal: 1 })))).toEqual([])
    }
  })

  it('matches by AI uni_week', () => {
    const aiRows = new Map([[climate.id, ai(climate.id, { role: 'slides', uni_week: 13, session_type: 'Lecture' })]])
    expect(matchSession(lecture('2026-10-12T09:00:00Z'), ctx({ contents: rows, ai: aiRows })).slides[0]).toMatchObject({
      confidence: 'week',
    })
    expect(all(matchSession(lecture('2026-10-05T09:00:00Z'), ctx({ contents: rows, ai: aiRows })))).toEqual([])
  })

  it('matches by AI lecture_ordinal', () => {
    const aiRows = new Map([[climate.id, ai(climate.id, { role: 'slides', lecture_ordinal: 2 })]])
    expect(matchSession(lecture('2026-10-12T09:00:00Z'), ctx({ contents: rows, ai: aiRows, ordinal: 2 })).slides[0]).toMatchObject({
      confidence: 'ordinal',
    })
    expect(all(matchSession(lecture('2026-10-05T09:00:00Z'), ctx({ contents: rows, ai: aiRows, ordinal: 1 })))).toEqual([])
  })

  it('a classified folder passes its AI week down', () => {
    const aiRows = new Map([[block.id, ai(block.id, { uni_week: 14 })]])
    expect(titles(all(matchSession(lecture('2026-10-19T09:00:00Z'), ctx({ contents: rows, ai: aiRows }))))).toEqual([
      'Climate systems',
    ])
  })
})

describe('matchSession: roles, links and exclusions', () => {
  const week = content({ id: 'wk', kind: 'folder', title: 'Week 12: Introduction Lecture', week_label: 12 })
  const panopto = child(week, {
    id: 'pan',
    kind: 'tool',
    title: 'Encore - Recordings Folder',
    links: [{ href: 'https://durham.cloud.panopto.eu/x', label: 'Recording', kind: 'panopto' }],
  })
  const admin = child(week, { id: 'adm', kind: 'document', title: 'Room change notice' })
  const handout = child(week, { id: 'hand', kind: 'document', title: 'Handout' })
  const aiReading = child(week, { id: 'air', kind: 'link', title: 'Chapter 2', url: 'https://www.sciencedirect.com/x' })
  const rows = [week, panopto, admin, handout, aiReading]
  const aiRows = new Map([
    [admin.id, ai(admin.id, { role: 'admin' })],
    [aiReading.id, ai(aiReading.id, { role: 'reading' })],
  ])
  const m = matchSession(session({ start: '2026-10-05T10:00:00Z' }), ctx({ contents: rows, ai: aiRows }))

  it('sorts items into slides / readings / recordings / other by link, then AI role', () => {
    expect(titles(m.recordings)).toEqual(['Encore - Recordings Folder'])
    expect(m.recordings[0].href).toBe('https://durham.cloud.panopto.eu/x')
    expect(titles(m.readings)).toEqual(['Chapter 2'])
    expect(m.readings[0]).toMatchObject({ href: 'https://www.sciencedirect.com/x', label: 'Chapter 2' })
    expect(titles(m.other)).toEqual(['Handout'])
  })

  it('leaves AI admin rows out', () => {
    expect(titles(all(m))).not.toContain('Room change notice')
  })

  it('ignores removed rows', () => {
    const removed = { ...handout, removed_at: '2026-11-11T00:00:00Z' }
    const r = matchSession(session({ start: '2026-10-05T10:00:00Z' }), ctx({ contents: [week, removed] }))
    expect(all(r)).toEqual([])
  })

  it('a deadline title is not a session date', () => {
    const essay = content({ id: 'ess', kind: 'assignment', title: 'Summative Essay due 16th February 2027 by 2pm (CMP002/ESFN41)' })
    const r = matchSession(session({ moduleCode: 'GEOG1061', start: '2027-02-16T10:00:00Z' }), ctx({ contents: [essay] }))
    expect(all(r)).toEqual([])
  })
})

describe('matchSession: overrides', () => {
  const week = content({ id: 'wk', kind: 'folder', title: 'Week 12: Introduction Lecture', week_label: 12 })
  const intro = child(week, { id: 'intro', title: 'Introduction', links: [slides('Intro.pptx')] })
  const unrelated = content({ id: 'unrel', kind: 'document', title: 'Field course guide' })
  const rows = [week, intro, unrelated]
  const lecture = session({ start: '2026-10-05T10:00:00Z' })

  it('hide removes that item from that session only', () => {
    const overrides = [{ session_uid: lecture.uid, content_id: intro.id, action: 'hide' as const }]
    expect(all(matchSession(lecture, ctx({ contents: rows, overrides })))).toEqual([])
    const other = session({ start: '2026-10-07T10:00:00Z' })
    expect(titles(all(matchSession(other, ctx({ contents: rows, overrides }))))).toEqual(['Introduction'])
  })

  it('attach adds an item nothing matched, marked attached and listed first', () => {
    const overrides = [{ session_uid: lecture.uid, content_id: unrelated.id, action: 'attach' as const }]
    const m = matchSession(lecture, ctx({ contents: rows, overrides }))
    expect(m.other).toEqual([expect.objectContaining({ confidence: 'attached', label: 'Field course guide' })])
    expect(titles(m.slides)).toEqual(['Introduction'])
  })

  it("ignores another session's overrides", () => {
    const overrides = [{ session_uid: 'someone-else', content_id: intro.id, action: 'hide' as const }]
    expect(titles(all(matchSession(lecture, ctx({ contents: rows, overrides }))))).toEqual(['Introduction'])
  })
})

describe('matchSession: key dates and the module reading list', () => {
  const talisTop = content({
    id: 'talis',
    kind: 'tool',
    title: 'Link to Reading List in Talis Aspire',
    links: [{ href: 'https://blackboard.durham.ac.uk/ultra/x', label: 'Link to Reading List in Talis Aspire', kind: 'talis' }],
  })
  const week = content({ id: 'wk', kind: 'folder', title: 'Week 2 (12 October)', week_label: 2 })
  const nestedTalis = child(week, {
    id: 'nt',
    kind: 'document',
    title: 'Week 2 readings',
    links: [{ href: 'https://rl.talis.com/3/durham/lists/W2.html', label: 'Talis Aspire reading list', kind: 'talis' }],
  })

  it('finds the top-level Talis list only', () => {
    expect(moduleReadingList([week, nestedTalis, talisTop])).toEqual({
      href: 'https://blackboard.durham.ac.uk/ultra/x',
      label: 'Link to Reading List in Talis Aspire',
    })
    expect(moduleReadingList([week, nestedTalis])).toBeNull()
  })

  it('lists non-dismissed key dates for the day or the week (with the course offset)', () => {
    const lecture = session({ moduleCode: 'GEOG1061', start: '2026-10-14T13:00:00Z' })
    const keyDates = [
      keyDate({ id: 'day', due_on: '2026-10-14', title: 'Bring a printed map' }),
      keyDate({ id: 'week', due_on: '2026-10-16', for_week: 2, title: 'Read chapter 2' }),
      keyDate({ id: 'dismissed', due_on: '2026-10-14', status: 'dismissed' }),
      keyDate({ id: 'other-course', due_on: '2026-10-14', course_id: 'elsewhere' }),
      keyDate({ id: 'tutorial', due_on: '2026-10-14', for_session_type: 'Tutorial' }),
      keyDate({ id: 'later', due_on: '2026-10-21' }),
    ]
    const m = matchSession(lecture, ctx({ contents: [talisTop, week, nestedTalis], keyDates }))
    expect(m.weekOffset).toBe(11)
    expect(m.keyDates.map((k) => k.id)).toEqual(['day', 'week'])
    expect(m.moduleReadingList?.label).toBe('Link to Reading List in Talis Aspire')
  })
})

describe('matchSession never depends on prep state', () => {
  const deepFreeze = <T>(value: T): T => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value)
      for (const v of Object.values(value)) deepFreeze(v)
    }
    return value
  }
  const week = content({ id: 'wk', kind: 'folder', title: 'Week 12: Introduction Lecture', week_label: 12 })
  const intro = child(week, { id: 'intro', title: 'Introduction', links: [slides('Intro.pptx')] })

  it('returns the same result whether prep is handed in or not, without mutating anything', () => {
    const base = session({ start: '2026-10-05T10:00:00Z' })
    const withPrep = (prepDone: boolean): SessionWithPrep =>
      deepFreeze({
        ...base,
        source: 'timetable',
        tracked: true,
        readings: { done: 0, total: 0 },
        tasks: { prep: { done: 0, total: 0 }, post: { done: 0, total: 0 } },
        prepDone,
        prepDoneAt: prepDone ? '2026-10-04T12:00:00Z' : null,
        notesDone: false,
        note: null,
        status: prepDone ? 'green' : 'red',
        postStatus: 'pending',
        workspaceId: null,
      })
    const context = deepFreeze(ctx({ contents: [week, intro], ordinal: 1 }))
    const notDone = withPrep(false)
    const done = withPrep(true)
    expect(matchSession(notDone, context)).toEqual(matchSession(done, context))
    expect(notDone.status).toBe('red')
    expect(done.prepDone).toBe(true)
  })
})

// ------------------------------------------------- real course layouts --
// The user's actual Blackboard structures and timetable (2026/27). Each
// module's sessions are passed in, as useSessionBlackboard does.

function timetable(moduleCode: string, moduleName: string, type: string, days: string[]): TimetableSession[] {
  return days.map((d) => {
    const [dd, mm] = d.split('/')
    return session({ moduleCode, moduleName, type, start: `2026-${mm}-${dd}T10:00:00Z` })
  })
}

const panopto = (label: string): BbContentLink => ({ href: `https://durham.cloud.panopto.eu/${encodeURIComponent(label)}`, label, kind: 'panopto' })
const file = (label: string): BbContentLink => ({ href: `https://blackboard.durham.ac.uk/bbcswebdav/${encodeURIComponent(label)}`, label, kind: 'file' })

/** Match one session the way the hook does: module sessions, ordinals, and (optionally) a prebuilt index. */
function matchIn(
  sessions: TimetableSession[],
  contents: BbContentLite[],
  s: TimetableSession,
  over: Partial<MatchContext> = {}
) {
  return matchSession(
    s,
    ctx({ contents, sessions, ordinal: sessionOrdinals(sessions).get(s.uid) ?? null, ...over })
  )
}

const ids = (m: ReturnType<typeof matchSession>) => all(m).map((i) => i.content.id)
const on = (sessions: TimetableSession[], day: string, type = 'Lecture') => {
  const [dd, mm] = day.split('/')
  const s = sessions.find((x) => x.start.startsWith(`2026-${mm}-${dd}`) && x.type === type)
  if (!s) throw new Error(`no ${type} on ${day}`)
  return s
}

describe('real layout: GEOG1071 Human Geography (dated recordings, lecture numbers)', () => {
  const lectures = timetable('GEOG1071', 'Human Geography', 'Lecture', [
    '06/10', '13/10', '15/10', '20/10', '22/10', '27/10', '29/10', '03/11', '05/11', '10/11', '12/11', '17/11', '19/11', '24/11',
  ])
  const tutorials = timetable('GEOG1071', 'Human Geography', 'Tutorial', ['12/11', '10/12'])
  const sessions = [...lectures, ...tutorials]

  const l1 = content({ id: 'l1', kind: 'lesson', title: 'Lecture 1: Situating the Discipline (Dr Ivan Marković)' })
  const l1rec = child(l1, { id: 'l1rec', kind: 'tool', title: '06/10/2026 : Human Geography', links: [panopto('Recording')] })
  const l1slides = child(l1, { id: 'l1slides', title: 'HG_1_SLIDES.pptx', links: [slides('HG_1_SLIDES.pptx')] })
  const nature = content({ id: 'nature', kind: 'folder', title: 'Block 2: Nature (Dr Ivan Marković)' })
  const natureDates: Record<number, string> = {
    2: '13/10/2026', 3: '15/10/2026', 4: '20/10/2026', 5: '22/10/2026', 6: '27/10/2026',
    7: '29/10/2026', 8: '03/11/2026', 9: '05/11/2026', 10: '10/11/2026',
  }
  const natureRows = Object.entries(natureDates).flatMap(([n, date]) => {
    const folder = child(nature, { id: `nl${n}`, kind: 'folder', title: `Lecture ${n}: ${n === '2' ? 'Nature' : `Nature topic ${n}`}` })
    const rec = child(folder, { id: `nl${n}rec`, kind: 'tool', title: `${date} : Human Geography`, links: [panopto(`Recording ${n}`)] })
    const name = n === '2' ? 'HG_2_Nature_SLIDES.pptx' : `HG_${n}_SLIDES.pptx`
    const deck = child(folder, { id: `nl${n}slides`, title: name, links: [slides(name)] })
    return [folder, rec, deck]
  })
  const lecture8 = natureRows.find((r) => r.id === 'nl8')!
  const chapter = child(lecture8, { id: 'chap4', title: 'Chap. 4 - Changes in the land ….pdf', links: [file('Chap. 4 - Changes in the land.pdf')] })
  const tutorial1 = child(nature, { id: 't1', kind: 'folder', title: 'Tutorial 1: Theory Goes Wild' })
  const casePack = child(tutorial1, { id: 'casepack', title: '2_Student_Case_Pack.pdf', links: [file('2_Student_Case_Pack.pdf')] })
  const landscape = content({ id: 'landscape', kind: 'folder', title: 'Block 2: Landscape (Dr Marijn Nieuwenhuis)' })
  const landscapeRows = [11, 12, 19].flatMap((n) => {
    const title = n === 11 ? 'Lecture 11: Introducing Landscape' : n === 19 ? 'Lecture 19: Writing new Landscapes' : `Lecture ${n}: Landscape ${n}`
    const folder = child(landscape, { id: `ll${n}`, kind: 'folder', title })
    return [folder, child(folder, { id: `ll${n}doc`, kind: 'document', title: 'ultraDocumentBody' })]
  })
  const tutorial3 = child(landscape, { id: 't3', kind: 'folder', title: 'Tutorial Three: Cinematic Landscapes' })
  const tutorial3Doc = child(tutorial3, { id: 't3doc', kind: 'document', title: 'ultraDocumentBody' })
  const rows = [
    l1, l1rec, l1slides, nature, ...natureRows, chapter, tutorial1, casePack, landscape, ...landscapeRows, tutorial3, tutorial3Doc,
  ]
  const course = { id: 'course', week_offset: 0, name: 'Human Geography' }

  it('a lecture folder takes the date of its recording; its slides match that lecture by date', () => {
    const m = matchIn(sessions, rows, on(lectures, '13/10'), { course })
    expect(titles(m.slides)).toEqual(['HG_2_Nature_SLIDES.pptx'])
    expect(m.slides[0].confidence).toBe('date')
    expect(titles(m.recordings)).toEqual(['13/10/2026 : Human Geography'])
  })

  it('Lecture 1 (a top-level lesson) gets its recording and slides on 6 Oct', () => {
    expect(ids(matchIn(sessions, rows, on(lectures, '06/10'), { course })).sort()).toEqual(['l1rec', 'l1slides'])
  })

  it("the Lecture 8 pdf goes to 3 Nov", () => {
    const m = matchIn(sessions, rows, on(lectures, '03/11'), { course })
    expect(ids(m)).toContain('chap4')
    expect(all(m).find((i) => i.content.id === 'chap4')?.confidence).toBe('date')
  })

  it('Lecture 11 (no recordings yet) goes to the 11th lecture, 12 Nov, from the dated series (not a guess)', () => {
    const index = buildCourseIndex({ course, contents: rows, ai: new Map(), overrides: [], weekOneStart: WEEK_ONE, sessions })
    expect(index.series.get('lecture|lecture')).toEqual({ offset: 0, source: 'dated' })
    const m = matchIn(sessions, rows, on(lectures, '12/11'), { course, index })
    expect(ids(m)).toEqual(['ll11doc'])
    expect(all(m)[0]).toMatchObject({ confidence: 'ordinal' })
    expect(all(m)[0].inferred).toBeUndefined()
    expect(ids(matchIn(sessions, rows, on(lectures, '17/11'), { course }))).toEqual(['ll12doc'])
  })

  it('the tutorial case pack goes to the first tutorial (12 Nov) and never to a lecture', () => {
    expect(ids(matchIn(sessions, rows, on(tutorials, '12/11', 'Tutorial'), { course }))).toEqual(['casepack'])
    for (const l of lectures) expect(ids(matchIn(sessions, rows, l, { course }))).not.toContain('casepack')
  })

  it('Tutorial Three runs past the two timetabled tutorials: matched nowhere', () => {
    for (const s of sessions) expect(ids(matchIn(sessions, rows, s, { course }))).not.toContain('t3doc')
    // Lecture 19 runs past the 14 lectures too.
    for (const s of sessions) expect(ids(matchIn(sessions, rows, s, { course }))).not.toContain('ll19doc')
  })

  it('a prebuilt index gives exactly what matchSession builds itself', () => {
    const index = buildCourseIndex({ course, contents: rows, ai: new Map(), overrides: [], weekOneStart: WEEK_ONE, sessions })
    for (const s of sessions) {
      expect(matchIn(sessions, rows, s, { course, index })).toEqual(matchIn(sessions, rows, s, { course }))
    }
  })

  it('a recording titled with the module name only counts when the name is known', () => {
    // Without the course name or the module's sessions, "Human Geography" is just words.
    const bare = buildCourseIndex({ course: { id: 'course', week_offset: 0 }, contents: rows, ai: new Map(), overrides: [], weekOneStart: WEEK_ONE })
    expect(bare.rows.find((r) => r.content.id === 'nl2slides')?.target.date).toBeUndefined()
    const named = buildCourseIndex({ course, contents: rows, ai: new Map(), overrides: [], weekOneStart: WEEK_ONE })
    expect(named.rows.find((r) => r.content.id === 'nl2slides')?.target).toMatchObject({ date: '2026-10-13', via: 'ancestor' })
  })
})

describe('real layout: GEOG1081 Physical Geography (numbering restarts per block)', () => {
  const lectures = timetable('GEOG1081', 'Physical Geography', 'Lecture', [
    '05/10', '07/10', '12/10', '14/10', '19/10', '21/10', '26/10', '02/11', '04/11', '09/11', '11/11', '16/11', '18/11', '23/11',
  ])
  const intro = content({ id: 'intro', kind: 'folder', title: 'Week 12: Introduction Lecture', week_label: 12 })
  const introDoc = child(intro, { id: 'introDoc', kind: 'document', title: 'ultraDocumentBody' })
  const climateTopics = [
    'The Climate System', 'Radiation', 'Atmospheric Circulation', 'Oceans', 'Past Climates', 'Future Climates',
    'Climate Interactive/Revision session',
  ]
  const block1 = content({ id: 'b1', kind: 'folder', title: 'Block 1: Climate' })
  const climate = climateTopics.flatMap((topic, i) => {
    const folder = child(block1, { id: `c${i + 1}`, kind: 'folder', title: `Climate Lecture ${i + 1}: ${topic}` })
    return [folder, child(folder, { id: `c${i + 1}doc`, kind: 'document', title: 'ultraDocumentBody' })]
  })
  const waterTopics = ['Hydrological Cycle', 'Rivers', 'Groundwater', 'Water Resources', 'Solutes and Anthropogenic Sediment']
  const block2 = content({ id: 'b2', kind: 'folder', title: 'Block 2: Water and Water Resources' })
  const water = waterTopics.flatMap((topic, i) => {
    const folder = child(block2, { id: `w${i + 1}`, kind: 'folder', title: `Water Lecture ${i + 1}: ${topic}` })
    return [folder, child(folder, { id: `w${i + 1}doc`, kind: 'document', title: 'ultraDocumentBody' })]
  })
  // Listed in an arbitrary order, as the database returns them: course order comes from the paths.
  const rows = [...water, block2, intro, introDoc, block1, ...climate]
  const at = (day: string) => ids(matchIn(lectures, rows, on(lectures, day)))

  it('counts each block on from the last: intro 5 Oct, Climate 1 → 7 Oct, Climate 7 → 2 Nov, Water 1 → 4 Nov, Water 5 → 18 Nov', () => {
    expect(at('05/10')).toEqual(['introDoc'])
    expect(at('07/10')).toContain('c1doc')
    expect(at('07/10')).not.toContain('w1doc')
    expect(at('02/11')).toEqual(['c7doc'])
    expect(at('04/11')).toEqual(['w1doc'])
    expect(at('18/11')).toEqual(['w5doc'])
    expect(at('23/11')).toEqual([])
  })

  it('marks the counted-on matches as a best guess', () => {
    const m = matchIn(lectures, rows, on(lectures, '04/11'))
    expect(all(m)).toEqual([expect.objectContaining({ confidence: 'ordinal', inferred: true })])
    const index = buildCourseIndex({ course: { id: 'course', week_offset: 0 }, contents: rows, ai: new Map(), overrides: [], weekOneStart: WEEK_ONE, sessions: lectures })
    expect(index.weekOffset).toBe(0)
    expect(index.series.get('lecture|climate lecture')).toEqual({ offset: 1, source: 'cumulative' })
    expect(index.series.get('lecture|water lecture')).toEqual({ offset: 8, source: 'cumulative' })
  })

  it('matches nothing past the last lecture rather than guessing', () => {
    const block3 = content({ id: 'b3', kind: 'folder', title: 'Block 3: Landscapes' })
    const extra = [1, 2].flatMap((n) => {
      const folder = child(block3, { id: `x${n}`, kind: 'folder', title: `Landscape Lecture ${n}: Glaciers` })
      return [folder, child(folder, { id: `x${n}doc`, kind: 'document', title: 'ultraDocumentBody' })]
    })
    const more = [...rows, block3, ...extra]
    expect(ids(matchIn(lectures, more, on(lectures, '23/11')))).toEqual(['x1doc'])
    for (const s of lectures) expect(ids(matchIn(lectures, more, s))).not.toContain('x2doc')
  })

  it('an attached numbered item calibrates its series and outranks counting on', () => {
    // I attach Water Lecture 1 to the 9 Nov lecture (10th): water is one later than counted.
    const overrides = [{ session_uid: on(lectures, '09/11').uid, content_id: 'w1doc', action: 'attach' as const }]
    const index = buildCourseIndex({ course: { id: 'course', week_offset: 0 }, contents: rows, ai: new Map(), overrides, weekOneStart: WEEK_ONE, sessions: lectures })
    expect(index.series.get('lecture|water lecture')).toEqual({ offset: 9, source: 'attached' })
    const m = matchIn(lectures, rows, on(lectures, '11/11'), { overrides })
    expect(all(m)).toEqual([expect.objectContaining({ content: expect.objectContaining({ id: 'w2doc' }), confidence: 'ordinal' })])
    expect(all(m)[0].inferred).toBeUndefined()
  })
})

describe('numbered series: evidence and defaults', () => {
  const lectures = timetable('GEOG1222', 'Geographic Research', 'Lecture', ['05/10', '12/10', '19/10', '26/10', '02/11', '09/11'])
  const folders = [1, 2, 3, 4].flatMap((n) => {
    const folder = content({ id: `f${n}`, kind: 'folder', title: `Lecture ${n}: Topic ${n}` })
    return [folder, child(folder, { id: `f${n}doc`, kind: 'document', title: 'ultraDocumentBody' })]
  })
  const intro = content({ id: 'intro', kind: 'folder', title: 'Week 12: Introduction Lecture', week_label: 12 })
  const introDoc = child(intro, { id: 'introDoc', kind: 'document', title: 'ultraDocumentBody' })

  it('a single unprefixed series with no evidence keeps offset 0, whatever stands before it', () => {
    const index = buildCourseIndex({ course: { id: 'course', week_offset: 0 }, contents: [intro, introDoc, ...folders], ai: new Map(), overrides: [], weekOneStart: WEEK_ONE, sessions: lectures })
    expect(index.series.get('lecture|lecture')).toEqual({ offset: 0, source: 'default' })
    expect(ids(matchIn(lectures, [...folders], on(lectures, '12/10')))).toEqual(['f2doc'])
  })

  it('dated members shift undated ones: Lecture 2 dated 19 Oct (3rd) puts Lecture 4 on the 5th lecture', () => {
    const dated = child(folders[2], { id: 'f2rec', kind: 'tool', title: '19/10/2026 : Geographic Research', links: [panopto('rec')] })
    const contents = [...folders, dated]
    const m = matchIn(lectures, contents, on(lectures, '02/11'))
    expect(ids(m)).toEqual(['f4doc'])
    expect(all(m)[0]).toMatchObject({ confidence: 'ordinal' })
    expect(ids(matchIn(lectures, contents, on(lectures, '26/10')))).toEqual(['f3doc'])
  })

  it('an attachment outranks dated evidence', () => {
    const dated = child(folders[2], { id: 'f2rec', kind: 'tool', title: '19/10/2026 : Geographic Research', links: [panopto('rec')] })
    const overrides = [
      { session_uid: on(lectures, '05/10').uid, content_id: 'f1doc', action: 'attach' as const },
      { session_uid: on(lectures, '12/10').uid, content_id: 'f2doc', action: 'attach' as const },
    ]
    const index = buildCourseIndex({ course: { id: 'course', week_offset: 0 }, contents: [...folders, dated], ai: new Map(), overrides, weekOneStart: WEEK_ONE, sessions: lectures })
    expect(index.series.get('lecture|lecture')).toEqual({ offset: 0, source: 'attached' })
  })

  it('without the timetable, numbers match positions directly (as before)', () => {
    expect(ids(matchSession(on(lectures, '19/10'), ctx({ contents: folders, ordinal: 3 })))).toEqual(['f3doc'])
  })
})

describe('real layout: GEOG1061 Planet Under Pressure (teaching weeks, dates a day off)', () => {
  const lectures = timetable('GEOG1061', 'Planet Under Pressure', 'Lecture', [
    '05/10', '12/10', '19/10', '26/10', '02/11', '09/11', '16/11', '23/11', '30/11', '07/12',
  ])
  const block1 = content({ id: 'b1', kind: 'folder', title: 'Block 1 - – Environment and Conservation' })
  const week2 = child(block1, { id: 'w2', kind: 'folder', title: 'BLOCK 1.2, DRB, Week 2 (12 October)' })
  const recording = child(week2, { id: 'w2rec', kind: 'folder', title: 'Week 2 recording' })
  const recordingBody = child(recording, { id: 'w2body', kind: 'document', title: 'ultraDocumentBody' })
  const block2 = content({ id: 'b2', kind: 'folder', title: 'Block 2 - Biodiversity Under Pressure' })
  const week6 = child(block2, { id: 'w6', kind: 'folder', title: 'Week 6 (Nov 10) - Biodiversity: Threats & Challenges' })
  const session6 = child(week6, {
    id: 's6',
    title: 'Session 6_Biodiversity Under Pressure_Student_2627.pptx',
    links: [slides('Session 6_Biodiversity Under Pressure_Student_2627.pptx')],
  })
  const week7 = child(block2, { id: 'w7', kind: 'folder', title: 'Week 7 (Nov 17) - Ecosystem Services' })
  const week7Doc = child(week7, { id: 'w7doc', kind: 'document', title: 'ultraDocumentBody' })
  const week10 = child(block2, { id: 'w10', kind: 'folder', title: 'Week 10 (Dec 8) - Conservation Futures' })
  const week10Doc = child(week10, { id: 'w10doc', kind: 'document', title: 'ultraDocumentBody' })
  const rows = [block1, week2, recording, recordingBody, block2, week6, session6, week7, week7Doc, week10, week10Doc]

  it('calibrates offset 11 from the dated week titles', () => {
    expect(matchIn(lectures, rows, on(lectures, '09/11')).weekOffset).toBe(11)
  })

  it('Session 6 slides (in "Week 6 (Nov 10)", a Tuesday) go to the Monday 9 Nov lecture by week', () => {
    const m = matchIn(lectures, rows, on(lectures, '09/11'))
    expect(titles(m.slides)).toEqual(['Session 6_Biodiversity Under Pressure_Student_2627.pptx'])
    expect(m.slides[0].confidence).toBe('week')
    expect(ids(matchIn(lectures, rows, on(lectures, '02/11')))).toEqual([])
    expect(ids(matchIn(lectures, rows, on(lectures, '16/11')))).toEqual(['w7doc'])
    expect(ids(matchIn(lectures, rows, on(lectures, '07/12')))).toEqual(['w10doc'])
  })

  it('the week 2 recording goes to 12 Oct by date', () => {
    const m = matchIn(lectures, rows, on(lectures, '12/10'))
    expect(ids(m)).toEqual(['w2body'])
    expect(all(m)[0].confidence).toBe('date')
  })

  it("an unlabelled date that is no session day falls back to that date's week", () => {
    const lesson = content({ id: 'tue', kind: 'lesson', title: 'Tuesday 10 November: Biodiversity', links: [slides('Bio.pptx')] })
    const m = matchIn(lectures, [lesson], on(lectures, '09/11'))
    expect(all(m)).toEqual([expect.objectContaining({ confidence: 'week' })])
    expect(ids(matchIn(lectures, [lesson], on(lectures, '16/11')))).toEqual([])
    // Without the timetable there is no way to tell: nothing, as before.
    expect(all(matchSession(on(lectures, '09/11'), ctx({ contents: [lesson] })))).toEqual([])
  })
})

describe('real layout: GEOG1241 / GEOG1222 dated titles keep working with the timetable', () => {
  const lectures = timetable('GEOG1241', 'Borders', 'Lecture', ['05/10', '12/10', '19/10', '26/10', '02/11', '09/11', '11/11', '16/11'])
  const workshops = timetable('GEOG1241', 'Borders', 'Workshop', ['04/11', '02/12'])
  const sessions = [...lectures, ...workshops]
  const lesson = content({
    id: 'l9',
    kind: 'lesson',
    title: 'Monday, 9 November: Borders and Migration (Prof Lauren Martin)',
    links: [slides('Borders and Migration.pptx')],
  })
  const workshop = content({ id: 'w1', kind: 'folder', title: '2-6 November: Workshop I - Crisis of Democracy' })
  const brief = child(workshop, { id: 'w1b', kind: 'document', title: 'Workshop brief' })
  const updated = content({ id: 'upd', title: 'Border Crises Lecture 1 Slides-Updated 9 Nov. 2026', links: [slides('Border Crises 1.pptx')] })
  const rows = [lesson, workshop, brief, updated]

  it('the 9 Nov lesson matches 9 Nov only (a session day: no spreading to 11 Nov)', () => {
    expect(matchIn(sessions, rows, on(lectures, '09/11')).slides.map((s) => [s.content.id, s.confidence])).toEqual([['l9', 'date']])
    expect(ids(matchIn(sessions, rows, on(lectures, '11/11')))).toEqual([])
  })

  it('the workshop range matches the 4 Nov workshop, never a lecture', () => {
    expect(ids(matchIn(sessions, rows, on(workshops, '04/11', 'Workshop')))).toEqual(['w1b'])
    expect(ids(matchIn(sessions, rows, on(lectures, '02/11')))).not.toContain('w1b')
  })

  it('an "Updated 9 Nov" date is not a session date: Lecture 1 slides go to lecture 1 only', () => {
    const first = matchIn(sessions, rows, on(lectures, '05/10'))
    expect(first.slides).toEqual([expect.objectContaining({ content: updated, confidence: 'ordinal' })])
    expect(ids(matchIn(sessions, rows, on(lectures, '09/11')))).not.toContain('upd')
  })

  it('GEOG1222 "Lecture 1 - Mon 5th Oct 2026, 10am, ER201" still matches 5 Oct by date', () => {
    const g = timetable('GEOG1222', 'Geographic Research', 'Lecture', ['05/10', '12/10'])
    const l1 = content({ id: 'g1', title: 'Lecture 1 - Mon 5th Oct 2026, 10am, ER201', links: [slides('L1.pptx')] })
    expect(matchIn(g, [l1], on(g, '05/10')).slides[0]).toMatchObject({ confidence: 'date' })
    expect(ids(matchIn(g, [l1], on(g, '12/10')))).toEqual([])
  })
})

describe('"updated" and similar dates are never session dates', () => {
  const t = { yearStart: 2026, weekOffset: 0 }
  const target = (title: string) => resolveContentTarget({ title, path: [], week_label: null }, [], null, t)

  it('drops the date, keeps the lecture number', () => {
    expect(target('Border Crises Lecture 1 Slides-Updated 9 Nov. 2026')).toMatchObject({
      ordinal: 1,
      ordinalType: 'lecture',
      ordinalSeries: 'crises lecture',
    })
    expect(target('Border Crises Lecture 1 Slides-Updated 9 Nov. 2026').date).toBeUndefined()
  })

  it('covers revised / posted / uploaded / as of / version markers, any case', () => {
    for (const title of [
      'Lecture 3 slides (revised: 12/11/2026)',
      'Reading list as of 5 October',
      'Notes v2 12 October',
      'Handout UPLOADED on Monday 9 November',
      'Slides - posted - 9 Nov',
      'Slides version 3 9 Nov',
    ]) {
      expect(target(title).date, title).toBeUndefined()
    }
  })

  it('leaves real session dates alone', () => {
    expect(target('Monday, 9 November: Borders and Migration (Prof Lauren Martin)').date).toBe('2026-11-09')
    expect(target('Week 2 (12 October) - updated slides').date).toBe('2026-10-12')
  })

  it('does not calibrate weeks', () => {
    const cal = { weekOneStart: WEEK_ONE, yearStart: 2026 }
    expect(calibrateWeekOffset([{ title: 'Week 2 slides - updated 9 Nov', week_label: 2 }], cal)).toBe(11)
  })
})

describe('series names and number words', () => {
  const t = { yearStart: 2026, weekOffset: 0 }
  const target = (title: string) => resolveContentTarget({ title, path: [], week_label: null }, [], null, t)

  it('reads the words before the number', () => {
    expect(target('Climate Lecture 7: Climate Interactive/Revision session')).toMatchObject({ ordinal: 7, ordinalSeries: 'climate lecture' })
    expect(target('Water Lecture 1: Hydrological Cycle')).toMatchObject({ ordinal: 1, ordinalSeries: 'water lecture' })
    expect(target('Lecture 2: Nature')).toMatchObject({ ordinal: 2, ordinalSeries: 'lecture' })
    expect(target('Week 3 Lecture 2')).toMatchObject({ ordinal: 2, ordinalSeries: 'lecture' })
    expect(target('Online Lecture 2')).toMatchObject({ ordinal: 2, ordinalSeries: 'lecture' })
  })

  it('reads number words and roman numerals', () => {
    expect(target('Tutorial Three: Cinematic Landscapes')).toMatchObject({ ordinal: 3, ordinalType: 'tutorial', ordinalSeries: 'tutorial' })
    expect(target('2-6 November: Workshop I - Crisis of Democracy')).toMatchObject({ ordinal: 1, ordinalSeries: 'workshop' })
    expect(target('Lecture in the field').ordinal).toBeUndefined()
  })
})

describe('calibrateWeekOffset: labels on both scales', () => {
  const cal = (sessionDays?: string[]) => ({ weekOneStart: WEEK_ONE, yearStart: 2026, sessionDays })
  // A module teaching in university weeks 12-21 (5 Oct - 7 Dec).
  const term = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07']
  const rows = (labels: number[]) => labels.map((w) => ({ title: `Week ${w}`, week_label: w }))

  it('Week 2 + Week 14 (twice) with no dates: 0 puts more items in teaching weeks than 11 does', () => {
    expect(calibrateWeekOffset(rows([2, 14, 14]), cal(term))).toBe(0)
  })

  it('a tie, or no timetable to score against, → 0 (never Week 14 → week 25)', () => {
    expect(calibrateWeekOffset(rows([2, 14]), cal(term))).toBe(0)
    expect(calibrateWeekOffset(rows([2, 14]), cal())).toBe(0)
  })

  it('mostly teaching weeks scores 11', () => {
    expect(calibrateWeekOffset(rows([2, 3, 13]), cal(term))).toBe(11)
  })

  it('all ≤ 11 → 11; all ≥ 12 → 0; dated evidence still wins', () => {
    expect(calibrateWeekOffset(rows([1, 11]), cal(term))).toBe(11)
    expect(calibrateWeekOffset(rows([12, 20]), cal(term))).toBe(0)
    expect(calibrateWeekOffset([...rows([14, 14]), { title: 'Week 2 (12 October)', week_label: 2 }], cal(term))).toBe(11)
  })
})
