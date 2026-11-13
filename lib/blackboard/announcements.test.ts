import { describe, expect, it } from 'vitest'
import {
  announcementSource,
  excerpt,
  forModule,
  newestFirst,
  postedDayLabel,
  toAnnouncementViews,
  unreadCount,
  type AnnouncementCourse,
  type AnnouncementRow,
  type AnnouncementView,
} from './announcements'

const course = (id: string, module_code: string | null, name = `Course ${id}`): AnnouncementCourse => ({ id, module_code, name })

const row = (over: Partial<AnnouncementRow> & { id: string }): AnnouncementRow => ({
  course_id: 'c1',
  title: 'Title',
  body_text: 'Body',
  posted_at: '2026-11-10T09:00:00Z',
  url: 'https://bb/x',
  read_at: null,
  first_seen_at: '2026-11-11T09:00:00Z',
  ...over,
})

describe('excerpt', () => {
  it('collapses whitespace and keeps short text whole', () => {
    expect(excerpt('  Hello\n\n  there   world ')).toBe('Hello there world')
  })

  it('is empty for no body', () => {
    expect(excerpt(null)).toBe('')
    expect(excerpt(undefined)).toBe('')
    expect(excerpt('   ')).toBe('')
  })

  it('cuts at a word boundary with an ellipsis', () => {
    const text = 'The quick brown fox jumps over the lazy dog and keeps running'
    const out = excerpt(text, 30)
    expect(out).toBe('The quick brown fox jumps over…')
    expect(out.length).toBeLessThanOrEqual(31)
  })

  it('hard-cuts an unbroken string and drops trailing punctuation before the ellipsis', () => {
    expect(excerpt('abcdefghijklmnopqrstuvwxyz', 10)).toBe('abcdefghij…')
    expect(excerpt('One, two, three, four, five, six', 15)).toBe('One, two, three…')
  })
})

describe('toAnnouncementViews', () => {
  const courses = [course('c1', 'GEOG1081'), course('c2', null, 'Careers'), course('c3', 'GEOG1091')]

  it('joins course info and sorts newest first', () => {
    const views = toAnnouncementViews(
      [
        row({ id: 'a', posted_at: '2026-11-01T09:00:00Z' }),
        row({ id: 'b', course_id: 'c2', posted_at: '2026-11-12T09:00:00Z' }),
        row({ id: 'c', course_id: 'c3', posted_at: '2026-11-05T09:00:00Z', read_at: '2026-11-06T00:00:00Z' }),
      ],
      courses
    )
    expect(views.map((v) => v.id)).toEqual(['b', 'c', 'a'])
    expect(views[0]).toMatchObject({ moduleCode: null, courseName: 'Careers', read: false })
    expect(views[1]).toMatchObject({ moduleCode: 'GEOG1091', read: true })
  })

  it('falls back to first_seen_at when no posted day, and drops unknown courses', () => {
    const views = toAnnouncementViews(
      [row({ id: 'a', posted_at: null }), row({ id: 'z', course_id: 'gone' })],
      courses
    )
    expect(views).toHaveLength(1)
    expect(views[0].postedAt).toBe('2026-11-11T09:00:00Z')
  })

  it('turns a null body into an empty string', () => {
    expect(toAnnouncementViews([row({ id: 'a', body_text: null })], courses)[0].bodyText).toBe('')
  })
})

describe('newestFirst', () => {
  it('puts missing days last and is stable by id', () => {
    const list = [
      { id: 'b', postedAt: null },
      { id: 'a', postedAt: '2026-11-01T00:00:00Z' },
      { id: 'c', postedAt: '2026-11-01T00:00:00Z' },
    ]
    expect(newestFirst(list).map((x) => x.id)).toEqual(['a', 'c', 'b'])
  })

  it('does not mutate its input', () => {
    const list = [
      { id: 'a', postedAt: '2026-11-01T00:00:00Z' },
      { id: 'b', postedAt: '2026-11-02T00:00:00Z' },
    ]
    newestFirst(list)
    expect(list.map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('unreadCount / forModule / announcementSource', () => {
  const view = (id: string, moduleCode: string | null, read: boolean): AnnouncementView => ({
    id,
    courseId: 'c',
    moduleCode,
    courseName: 'Careers',
    title: 't',
    bodyText: '',
    postedAt: null,
    url: null,
    read,
  })
  const list = [view('a', 'GEOG1081', false), view('b', 'GEOG1081', true), view('c', null, false)]

  it('counts unread', () => {
    expect(unreadCount(list)).toBe(2)
    expect(unreadCount([])).toBe(0)
  })

  it('keeps one module', () => {
    expect(forModule(list, 'GEOG1081').map((a) => a.id)).toEqual(['a', 'b'])
    expect(forModule(list, 'GEOG9999')).toEqual([])
  })

  it('names the source by module code, else course name', () => {
    expect(announcementSource(list[0])).toBe('GEOG1081')
    expect(announcementSource(list[2])).toBe('Careers')
  })
})

describe('postedDayLabel', () => {
  const now = new Date('2026-11-13T12:00:00Z')

  it('says Today and Yesterday by London day', () => {
    expect(postedDayLabel('2026-11-13T00:30:00Z', now)).toBe('Today')
    expect(postedDayLabel('2026-11-12T23:59:00Z', now)).toBe('Yesterday')
  })

  it('shows day and month, adding the year when it is not this one', () => {
    expect(postedDayLabel('2026-11-02T09:00:00Z', now)).toBe('2 Nov')
    expect(postedDayLabel('2025-12-24T09:00:00Z', now)).toBe('24 Dec 2025')
  })

  it('is empty for a missing or bad date', () => {
    expect(postedDayLabel(null, now)).toBe('')
    expect(postedDayLabel('nope', now)).toBe('')
  })
})
