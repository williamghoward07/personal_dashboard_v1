// The unified "what do I need to do, and when" list: official Blackboard
// assignments, AI-found key dates, tests from the timetable and (optionally)
// lecture prep, as one WorkItem shape. Pure: no React, Next or Supabase.
//
// Lecture prep keeps its existing semantics: an item is done once handed in
// (Mark as done), and its Upcoming / Past due / Completed placement comes
// straight from `assignmentLists` (lib/timetable/session.ts).

import { londonDateKey, londonDayBoundsUTC } from '@/lib/google/london-day'
import { assignmentLists, hasEnded, type SessionWithPrep } from '@/lib/timetable/session'
import { addDays, londonToday } from './dates'
import type { BbAssignmentRecord, BbCourseRecord, BbKeyDate } from './types'

// --------------------------------------------------------------- categories --

export const WORK_CATEGORIES = ['summative', 'formative', 'test', 'tutorial', 'session_task', 'other', 'lecture_prep'] as const
export type WorkCategory = (typeof WORK_CATEGORIES)[number]

export const WORK_CATEGORY_LABEL: Record<WorkCategory, string> = {
  summative: 'Summative',
  formative: 'Formative',
  test: 'Tests',
  tutorial: 'Tutorial work',
  session_task: 'Session tasks',
  other: 'Other',
  lecture_prep: 'Lecture prep',
}

export const WORK_TABS = ['upcoming', 'pastDue', 'completed'] as const
export type WorkTab = (typeof WORK_TABS)[number]

export function isWorkCategory(value: unknown): value is WorkCategory {
  return typeof value === 'string' && (WORK_CATEGORIES as readonly string[]).includes(value)
}

// ------------------------------------------------------------------- items --

export interface WorkItem {
  /** 'bba:<id>' | 'kd:<id>' | 'prep:<uid>' | 'test:<uid>' */
  key: string
  source: 'assignment' | 'key_date' | 'prep' | 'session'
  category: WorkCategory
  moduleCode: string | null
  courseName: string | null
  title: string
  /** London day key. */
  dueOn: string | null
  /** ISO instant, when a time is known. */
  dueAt: string | null
  done: boolean
  doneVia: 'blackboard' | 'dashboard' | 'session' | null
  /** Set on AI-found key dates only. */
  ai: { status: 'suggested' | 'confirmed'; quote: string; sourceUrl: string | null } | null
  url: string | null
  bbStatus?: 'not_submitted' | 'submitted' | 'graded'
  /** Prep and test items keep their session so the UI can reuse SessionRow. */
  session?: SessionWithPrep
  assignmentId?: string
  keyDateId?: string
  /** An official assignment with no Blackboard due date, dated by this AI key date. */
  dueFromKeyDateId?: string
}

type CourseLite = Pick<BbCourseRecord, 'id' | 'module_code' | 'name' | 'url'>
type AssignmentLite = Pick<
  BbAssignmentRecord,
  'id' | 'course_id' | 'title' | 'due_at' | 'status' | 'is_formative' | 'url' | 'done_at' | 'removed_at'
>
type KeyDateLite = Pick<
  BbKeyDate,
  | 'id'
  | 'course_id'
  | 'announcement_id'
  | 'content_id'
  | 'document_id'
  | 'title'
  | 'category'
  | 'due_on'
  | 'due_at'
  | 'quote'
  | 'status'
  | 'assignment_id'
  | 'done_at'
>

/**
 * Official assignment → category: Blackboard's formative flag first, then
 * the title ("Summative Essay …", "Formative Discussion Post", "… Quiz").
 */
export function workCategory(assignment: Pick<BbAssignmentRecord, 'is_formative' | 'title'>): WorkCategory {
  if (assignment.is_formative === true) return 'formative'
  if (assignment.is_formative === false) return 'summative'
  const title = assignment.title
  if (/\bsummative\b/i.test(title)) return 'summative'
  if (/\bformative\b/i.test(title)) return 'formative'
  if (/\b(?:tests?|exams?|examinations?|quiz(?:zes)?)\b/i.test(title)) return 'test'
  return 'other'
}

export interface WorkInput {
  courses: CourseLite[]
  assignments: AssignmentLite[]
  keyDates: KeyDateLite[]
  /** Timetable sessions with prep (useTimetable). */
  sessions: SessionWithPrep[]
  /** bb_content id → url, for a key date's source link. */
  contentUrlById?: Map<string, string | null>
  /** bb_announcements id → url. */
  announcementUrlById?: Map<string, string | null>
  /** bb_documents id → the bb_content id it's attached to. */
  documentContentId?: Map<string, string>
  now: Date
}

const isTestSession = (s: { type: string }) => s.type.trim().toLowerCase() === 'test'

/** Key dates folded into an official assignment: confirmed first, then the earliest. */
function foldedKeyDate(list: KeyDateLite[] | undefined): KeyDateLite | null {
  if (!list?.length) return null
  return [...list].sort(
    (a, b) => (a.status === 'confirmed' ? 0 : 1) - (b.status === 'confirmed' ? 0 : 1) || a.due_on.localeCompare(b.due_on)
  )[0]
}

/** Builds every work item. Dismissed key dates never appear. */
export function toWorkItems(input: WorkInput): WorkItem[] {
  const courseById = new Map(input.courses.map((c) => [c.id, c]))
  const live = input.keyDates.filter((kd) => kd.status === 'suggested' || kd.status === 'confirmed')
  const byAssignment = new Map<string, KeyDateLite[]>()
  for (const kd of live) {
    if (!kd.assignment_id) continue
    byAssignment.set(kd.assignment_id, [...(byAssignment.get(kd.assignment_id) ?? []), kd])
  }

  const items: WorkItem[] = []

  for (const a of input.assignments) {
    if (a.removed_at) continue
    const course = courseById.get(a.course_id)
    const bbDone = a.status === 'submitted' || a.status === 'graded'
    const fold = a.due_at ? null : foldedKeyDate(byAssignment.get(a.id))
    items.push({
      key: `bba:${a.id}`,
      source: 'assignment',
      category: workCategory(a),
      moduleCode: course?.module_code ?? null,
      courseName: course?.name ?? null,
      title: a.title,
      dueOn: a.due_at ? londonDateKey(a.due_at) : (fold?.due_on ?? null),
      dueAt: a.due_at ?? fold?.due_at ?? null,
      done: bbDone || !!a.done_at,
      doneVia: bbDone ? 'blackboard' : a.done_at ? 'dashboard' : null,
      ai: null,
      url: a.url ?? course?.url ?? null,
      bbStatus: a.status,
      assignmentId: a.id,
      ...(fold ? { dueFromKeyDateId: fold.id } : {}),
    })
  }

  const sourceUrl = (kd: KeyDateLite): string | null => {
    if (kd.content_id) return input.contentUrlById?.get(kd.content_id) ?? null
    if (kd.document_id) {
      const contentId = input.documentContentId?.get(kd.document_id)
      return contentId ? (input.contentUrlById?.get(contentId) ?? null) : null
    }
    if (kd.announcement_id) return input.announcementUrlById?.get(kd.announcement_id) ?? null
    return null
  }

  for (const kd of live) {
    if (kd.assignment_id) continue // the official row wins
    const course = courseById.get(kd.course_id)
    const url = sourceUrl(kd)
    items.push({
      key: `kd:${kd.id}`,
      source: 'key_date',
      category: kd.category,
      moduleCode: course?.module_code ?? null,
      courseName: course?.name ?? null,
      title: kd.title,
      dueOn: kd.due_on,
      dueAt: kd.due_at,
      done: !!kd.done_at,
      doneVia: kd.done_at ? 'dashboard' : null,
      ai: { status: kd.status as 'suggested' | 'confirmed', quote: kd.quote, sourceUrl: url },
      url: url ?? course?.url ?? null,
      keyDateId: kd.id,
    })
  }

  const courseByCode = new Map(
    input.courses.filter((c) => c.module_code).map((c) => [c.module_code as string, c])
  )
  for (const s of input.sessions) {
    // Same population as assignmentLists: timetable sessions with a module code.
    if (s.source !== 'timetable' || !s.moduleCode) continue
    const course = courseByCode.get(s.moduleCode)
    const base = {
      moduleCode: s.moduleCode,
      courseName: course?.name ?? s.moduleName,
      title: `${s.moduleName} - ${s.type}`,
      dueOn: londonDateKey(s.start),
      dueAt: s.start,
      ai: null,
      url: null,
      session: s,
    }
    if (isTestSession(s)) {
      const ended = hasEnded(s, input.now)
      items.push({ ...base, key: `test:${s.uid}`, source: 'session', category: 'test', done: ended, doneVia: ended ? 'session' : null })
    } else {
      items.push({
        ...base,
        key: `prep:${s.uid}`,
        source: 'prep',
        category: 'lecture_prep',
        done: s.prepDone,
        doneVia: s.prepDone ? 'dashboard' : null,
      })
    }
  }

  return items
}

// ------------------------------------------------------------------- lists --

/**
 * When an item is due, as epoch ms: its `dueAt`, else the end of its London
 * `dueOn` day (so an all-day item sorts after timed ones that day). Null
 * when undated.
 */
export function workDueInstant(item: Pick<WorkItem, 'dueOn' | 'dueAt'>): number | null {
  if (item.dueAt) return Date.parse(item.dueAt)
  if (item.dueOn) return Date.parse(londonDayBoundsUTC(new Date(`${item.dueOn}T12:00:00Z`)).timeMax)
  return null
}

/**
 * Undone and late: its `dueAt` has passed, or (date only) its London day is
 * over. Prep items: ended and not handed in (`isOverdue`). Timetable tests
 * are never late — they're done once they end.
 */
export function isWorkPastDue(item: WorkItem, now: Date): boolean {
  if (item.done) return false
  if (item.source === 'session') return false
  if (item.source === 'prep' && item.session) return hasEnded(item.session, now)
  const due = workDueInstant(item)
  if (due === null) return false
  return item.dueAt ? now.getTime() > due : now.getTime() >= due
}

export type WorkLists = Record<WorkTab, WorkItem[]>

function byDue(direction: 1 | -1) {
  return (a: WorkItem, b: WorkItem) => {
    const da = workDueInstant(a)
    const db = workDueInstant(b)
    if (da === null || db === null) {
      if (da !== db) return da === null ? 1 : -1 // undated last either way
    } else if (da !== db) {
      return (da - db) * direction
    }
    return a.title.localeCompare(b.title) || a.key.localeCompare(b.key)
  }
}

/**
 * Upcoming (soonest first, undated last), Past due (most overdue first) and
 * Completed (most recent first). Lecture prep is placed exactly as
 * `assignmentLists` places it.
 */
export function workLists(items: WorkItem[], now: Date): WorkLists {
  const prepSessions = items.filter((i) => i.source === 'prep' && i.session).map((i) => i.session as SessionWithPrep)
  const prepTabs = assignmentLists(prepSessions, now)
  const prepTab = new Map<string, WorkTab>()
  for (const tab of WORK_TABS) for (const s of prepTabs[tab]) prepTab.set(s.uid, tab)

  const lists: WorkLists = { upcoming: [], pastDue: [], completed: [] }
  for (const item of items) {
    let tab: WorkTab
    if (item.source === 'prep' && item.session) {
      const placed = prepTab.get(item.session.uid)
      if (!placed) continue
      tab = placed
    } else if (item.done) {
      tab = 'completed'
    } else {
      tab = isWorkPastDue(item, now) ? 'pastDue' : 'upcoming'
    }
    lists[tab].push(item)
  }
  lists.upcoming.sort(byDue(1))
  lists.pastDue.sort(byDue(1))
  lists.completed.sort(byDue(-1))
  return lists
}

// ----------------------------------------------------------------- filters --

export interface WorkFilter {
  categories: WorkCategory[] | 'all'
  /** Module codes. Items with no module (org courses) only show under 'all'. */
  modules: string[] | 'all'
}

export function applyWorkFilter(items: WorkItem[], filter: WorkFilter): WorkItem[] {
  return items.filter(
    (item) =>
      (filter.categories === 'all' || filter.categories.includes(item.category)) &&
      (filter.modules === 'all' || (item.moduleCode !== null && filter.modules.includes(item.moduleCode)))
  )
}

/** Undone, dated, not yet late, and due in the next `days` London days (today included), soonest first. */
export function dueWithin(items: WorkItem[], now: Date, days: number): WorkItem[] {
  const today = londonToday(now)
  const end = addDays(today, days)
  return items
    .filter((i) => !i.done && i.dueOn !== null && i.dueOn >= today && i.dueOn < end && !isWorkPastDue(i, now))
    .sort(byDue(1))
}

// ------------------------------------------------------------- sync status --

export type SyncState = 'never' | 'fresh' | 'stale' | 'failed'

/** A successful sync older than this is stale. */
export const SYNC_STALE_MS = 48 * 60 * 60 * 1000

export interface SyncRun {
  id: string
  started_at: string
  finished_at: string
  trigger: 'manual' | 'visit' | 'daily'
  ok: boolean
  counts: Record<string, unknown>
  error: string | null
}

export interface SyncStatus {
  state: SyncState
  /** When the last successful sync finished. */
  lastOkAt: string | null
  /** The last successful run's counts (courses, assignments, content …). */
  counts: Record<string, unknown> | null
  /** The latest run, ok or not. */
  lastRun: SyncRun | null
}

/**
 * From the newest runs first: none → never; the latest failed (e.g. logged
 * out of Blackboard) → failed; the last success over 48 h old → stale;
 * otherwise fresh.
 */
export function syncStatus(runs: SyncRun[], now: Date): SyncStatus {
  const sorted = [...runs].sort((a, b) => b.finished_at.localeCompare(a.finished_at))
  const lastRun = sorted[0] ?? null
  const lastOk = sorted.find((r) => r.ok) ?? null
  const base = { lastOkAt: lastOk?.finished_at ?? null, counts: lastOk?.counts ?? null, lastRun }
  if (!lastRun) return { state: 'never', ...base }
  if (!lastRun.ok) return { state: 'failed', ...base }
  const age = now.getTime() - Date.parse(lastRun.finished_at)
  return { state: age > SYNC_STALE_MS ? 'stale' : 'fresh', ...base }
}
