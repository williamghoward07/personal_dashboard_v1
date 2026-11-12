import { describe, expect, it } from 'vitest'
import type { SessionWithPrep, TimetableSession } from '@/lib/timetable/session'
import {
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
