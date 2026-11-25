// Announcements are an extra notification, never the main source: they show in
// a corner chip on a module's own page and in one running section on /lectures.
// Pure helpers (grouping, unread counts, excerpts, posted day): no React, Next
// or Supabase.

import { londonDateKey } from '@/lib/google/london-day'
import { addDays, londonToday } from './dates'
import type { BbAnnouncementRecord, BbCourseRecord } from './types'

/** The columns the dashboard reads; the full body is kept for the excerpt. */
export const ANNOUNCEMENT_COLUMNS = 'id, course_id, title, body_text, posted_at, url, read_at, first_seen_at'

export type AnnouncementRow = Pick<
  BbAnnouncementRecord,
  'id' | 'course_id' | 'title' | 'body_text' | 'posted_at' | 'url' | 'read_at' | 'first_seen_at'
>
export type AnnouncementCourse = Pick<BbCourseRecord, 'id' | 'module_code' | 'name'>

export interface AnnouncementView {
  id: string
  courseId: string
  /** Null for an org course, which has no module code. */
  moduleCode: string | null
  courseName: string
  title: string
  bodyText: string
  /** ISO instant; falls back to when it was first synced. */
  postedAt: string | null
  url: string | null
  read: boolean
}

/** Whitespace collapsed; cut at a word boundary with an ellipsis. */
export function excerpt(body: string | null | undefined, max = 160): string {
  const text = (body ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = text[max] === ' ' ? max : cut.lastIndexOf(' ')
  const clean = (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, '')
  return `${clean}…`
}

/** Joins announcements to their course, newest first. Courses missing from the list are dropped. */
export function toAnnouncementViews(rows: AnnouncementRow[], courses: AnnouncementCourse[]): AnnouncementView[] {
  const byId = new Map(courses.map((c) => [c.id, c]))
  const views: AnnouncementView[] = []
  for (const row of rows) {
    const course = byId.get(row.course_id)
    if (!course) continue
    views.push({
      id: row.id,
      courseId: row.course_id,
      moduleCode: course.module_code,
      courseName: course.name,
      title: row.title,
      bodyText: row.body_text ?? '',
      postedAt: row.posted_at ?? row.first_seen_at ?? null,
      url: row.url,
      read: !!row.read_at,
    })
  }
  return newestFirst(views)
}

/** Newest posted first; ties (and missing days) keep a stable order by id. */
export function newestFirst<T extends Pick<AnnouncementView, 'id' | 'postedAt'>>(list: T[]): T[] {
  const time = (a: T) => (a.postedAt ? Date.parse(a.postedAt) || 0 : 0)
  return [...list].sort((a, b) => time(b) - time(a) || a.id.localeCompare(b.id))
}

export function unreadCount(list: Pick<AnnouncementView, 'read'>[]): number {
  return list.filter((a) => !a.read).length
}

/** One module's announcements, in the order given. */
export function forModule(list: AnnouncementView[], moduleCode: string): AnnouncementView[] {
  return list.filter((a) => a.moduleCode === moduleCode)
}

/** "Today", "Yesterday", "12 Nov" (with the year when it isn't this one), by London day. */
export function postedDayLabel(postedAt: string | null, now: Date): string {
  if (!postedAt || Number.isNaN(Date.parse(postedAt))) return ''
  const day = londonDateKey(postedAt)
  const today = londonToday(now)
  if (day === today) return 'Today'
  if (day === addDays(today, -1)) return 'Yesterday'
  const [year, month, date] = day.split('-').map(Number)
  const label = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, date))
  )
  return year === Number(today.slice(0, 4)) ? label : `${label} ${year}`
}

/** What a row shows as its source: the module code, else the course name. */
export function announcementSource(a: Pick<AnnouncementView, 'moduleCode' | 'courseName'>): string {
  return a.moduleCode ?? a.courseName
}
