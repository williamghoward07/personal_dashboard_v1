// Timetable sessions (lectures, seminars, workshops…) and their prep state.
// Pure: parsing a MyTimetable title, the traffic light, grouping. The feed
// itself is read in ./feed.ts and parsed in ./ics.ts.

/** One occurrence from the timetable feed. `uid` is its identity. */
export interface TimetableSession {
  uid: string
  /** The raw SUMMARY, e.g. "GEOG1081: Physical Geography - Lecture". */
  title: string
  moduleCode: string | null
  moduleName: string
  /** "Lecture", "Seminar", "Online Session"… — whatever follows the last " - ". */
  type: string
  start: string
  end: string | null
  location: string | null
}

/** Red = nothing added; amber = added but not handed in; green = marked as done. */
export type PrepStatus = 'red' | 'amber' | 'green'

/** The after-session half: `pending` until prep is handed in (and the session has ended). */
export type PostStatus = PrepStatus | 'pending'

export interface ReadingCount {
  done: number
  total: number
}

export interface TaskCounts {
  /** Tasks before the session (a task with a link is a reading). */
  prep: ReadingCount
  /** Concepts to review after it. */
  post: ReadingCount
}

/** Where a session comes from: the ICS timetable, or a Google event with prep switched on. */
export type SessionSource = 'timetable' | 'calendar'

/** A session with what the user has recorded about it — the /api/timetable shape. */
export interface SessionWithPrep extends TimetableSession {
  source: SessionSource
  /** Always true for the timetable; a Google event's "track prep" switch. */
  tracked: boolean
  /** Readings filed in a workspace (workspace_links.session_uid). */
  readings: ReadingCount
  tasks: TaskCounts
  /** Prep handed in with Mark as done (`lecture_sessions.prep_done_at`). */
  prepDone: boolean
  /** When it was handed in. Null for a Google event (they're never listed). */
  prepDoneAt: string | null
  notesDone: boolean
  note: string | null
  /** Left half of the light: readings + prep tasks, green only once handed in. */
  status: PrepStatus
  /** Right half: concepts to review, or marked done. */
  postStatus: PostStatus
  /** The module workspace for `moduleCode`, if one exists. */
  workspaceId: string | null
}

/** What /api/timetable knows about one tracked Google event (no event data: that comes from Google). */
export interface TrackedPrep {
  uid: string
  tasks: TaskCounts
  prepDone: boolean
  notesDone: boolean
  note: string | null
}

const TITLE_RE = /^\s*([A-Z]{4}\d{4})\s*:\s*(.+?)\s*$/

/**
 * "GEOG1081: Physical Geography - Lecture" → code, name, type. A title that
 * doesn't follow the pattern keeps its text as the name with no code.
 */
export function parseSessionTitle(summary: string): Pick<TimetableSession, 'moduleCode' | 'moduleName' | 'type'> {
  const text = summary.trim()
  const match = TITLE_RE.exec(text)
  const rest = match ? match[2] : text
  const dash = rest.lastIndexOf(' - ')
  let moduleName = (dash === -1 ? rest : rest.slice(0, dash)).trim()
  // Uncoded events repeat their name: "Welcome Talks: Welcome Talks".
  const halves = moduleName.split(': ')
  if (!match && halves.length === 2 && halves[0] === halves[1]) moduleName = halves[0]
  const type = dash === -1 ? 'Session' : rest.slice(dash + 3).trim() || 'Session'
  return { moduleCode: match ? match[1] : null, moduleName: moduleName || text, type }
}

export const EMPTY_COUNT: ReadingCount = { done: 0, total: 0 }
export const EMPTY_TASKS: TaskCounts = { prep: EMPTY_COUNT, post: EMPTY_COUNT }

export function addCounts(a: ReadingCount, b: ReadingCount): ReadingCount {
  return { done: a.done + b.done, total: a.total + b.total }
}

/**
 * `items` = readings + prep tasks together. Like a Teams assignment, it's
 * only green once handed in — ticking every reading isn't enough.
 */
export function prepStatus(items: ReadingCount, prepDone: boolean): PrepStatus {
  if (prepDone) return 'green'
  return items.total === 0 ? 'red' : 'amber'
}

/**
 * `pending` until prep is handed in. Then green once marked done or every
 * concept is ticked; amber with concepts outstanding; otherwise red after
 * the session, `pending` before it.
 */
export function postStatus(concepts: ReadingCount, notesDone: boolean, prepDone: boolean, ended: boolean): PostStatus {
  if (!prepDone) return 'pending'
  if (notesDone) return 'green'
  if (concepts.total > 0) return concepts.done >= concepts.total ? 'green' : 'amber'
  return ended ? 'red' : 'pending'
}

export function hasEnded(session: Pick<TimetableSession, 'start' | 'end'>, now: Date): boolean {
  return new Date(session.end ?? session.start).getTime() < now.getTime()
}

/**
 * Ended without prep handed in. Follow-up has no due date, so it never
 * makes a session overdue.
 */
export function isOverdue(session: Pick<SessionWithPrep, 'start' | 'end' | 'status'>, now: Date): boolean {
  return hasEnded(session, now) && session.status !== 'green'
}

export const PREP_LABEL: Record<PrepStatus, string> = {
  red: 'No prep added',
  amber: 'Not handed in',
  green: 'Done',
}

export const POST_LABEL: Record<PostStatus, string> = {
  pending: 'Follow-up once handed in',
  red: 'Follow-up not done',
  amber: 'Concepts to review',
  green: 'Follow-up done',
}

/** Done/total readings per session uid. */
export function countReadingsBySession(
  links: { session_uid?: string | null; completed_at: string | null }[]
): Map<string, ReadingCount> {
  const counts = new Map<string, ReadingCount>()
  for (const link of links) {
    if (!link.session_uid) continue
    const count = counts.get(link.session_uid) ?? { done: 0, total: 0 }
    count.total += 1
    if (link.completed_at) count.done += 1
    counts.set(link.session_uid, count)
  }
  return counts
}

/** Done/total session_tasks per session uid, split by phase. */
export function countTasksBySession(
  tasks: { session_uid: string; phase: string; done_at: string | null }[]
): Map<string, TaskCounts> {
  const counts = new Map<string, TaskCounts>()
  for (const task of tasks) {
    const current = counts.get(task.session_uid) ?? EMPTY_TASKS
    const phase = task.phase === 'post' ? 'post' : 'prep'
    counts.set(task.session_uid, {
      ...current,
      [phase]: addCounts(current[phase], { done: task.done_at ? 1 : 0, total: 1 }),
    })
  }
  return counts
}

type SessionState = { prep_done_at?: string | null; notes_done_at: string | null; note: string | null }

export function withPrep(
  sessions: TimetableSession[],
  {
    readings,
    tasks = new Map(),
    states,
    workspaceByCode,
    now = new Date(),
  }: {
    readings: Map<string, ReadingCount>
    tasks?: Map<string, TaskCounts>
    states: Map<string, SessionState>
    workspaceByCode: Map<string, string>
    now?: Date
  }
): SessionWithPrep[] {
  return sessions.map((session) => {
    const count = readings.get(session.uid) ?? EMPTY_COUNT
    const taskCounts = tasks.get(session.uid) ?? EMPTY_TASKS
    const state = states.get(session.uid)
    const prepDone = !!state?.prep_done_at
    const notesDone = !!state?.notes_done_at
    return {
      ...session,
      source: 'timetable',
      tracked: true,
      readings: count,
      tasks: taskCounts,
      prepDone,
      prepDoneAt: state?.prep_done_at ?? null,
      notesDone,
      note: state?.note ?? null,
      status: prepStatus(addCounts(count, taskCounts.prep), prepDone),
      postStatus: postStatus(taskCounts.post, notesDone, prepDone, hasEnded(session, now)),
      workspaceId: session.moduleCode ? (workspaceByCode.get(session.moduleCode) ?? null) : null,
    }
  })
}

/** Tracked Google events, from lecture_sessions rows (tracked, uid `gcal:…`). */
export function trackedPrep(
  states: (SessionState & { uid: string; tracked?: boolean })[],
  tasks: Map<string, TaskCounts>
): TrackedPrep[] {
  return states
    .filter((row) => row.tracked && isCalendarEventUid(row.uid))
    .map((row) => ({
      uid: row.uid,
      tasks: tasks.get(row.uid) ?? EMPTY_TASKS,
      prepDone: !!row.prep_done_at,
      notesDone: !!row.notes_done_at,
      note: row.note,
    }))
}

const CALENDAR_UID_PREFIX = 'gcal:'

/** A Google event's session uid. Prefixed so it can never collide with an ICS UID. */
export function calendarEventUid(eventId: string): string {
  return `${CALENDAR_UID_PREFIX}${eventId}`
}

export function isCalendarEventUid(uid: string): boolean {
  return uid.startsWith(CALENDAR_UID_PREFIX)
}

/**
 * A Google event as a session, so the prep popover and lights work on it.
 * Untracked (prep is null) it's a normal event whose popover offers the
 * switch.
 */
export function calendarEventSession(
  event: { id: string; title: string; start: string; end: string | null },
  prep: TrackedPrep | null,
  now: Date
): SessionWithPrep {
  const tasks = prep?.tasks ?? EMPTY_TASKS
  const prepDone = prep?.prepDone ?? false
  const notesDone = prep?.notesDone ?? false
  const session: TimetableSession = {
    uid: calendarEventUid(event.id),
    title: event.title,
    moduleCode: null,
    moduleName: event.title,
    type: 'Event',
    start: event.start,
    end: event.end,
    location: null,
  }
  return {
    ...session,
    source: 'calendar',
    tracked: !!prep,
    readings: EMPTY_COUNT,
    tasks,
    prepDone,
    prepDoneAt: null,
    notesDone,
    note: prep?.note ?? null,
    status: prepStatus(tasks.prep, prepDone),
    postStatus: postStatus(tasks.post, notesDone, prepDone, hasEnded(session, now)),
    workspaceId: null,
  }
}

export interface ModuleGroup<T extends TimetableSession> {
  code: string
  name: string
  sessions: T[]
}

/** Sessions with a module code, grouped by code (sorted), each in start order. */
export function groupByModule<T extends TimetableSession>(sessions: T[]): ModuleGroup<T>[] {
  const groups = new Map<string, ModuleGroup<T>>()
  for (const session of sessions) {
    if (!session.moduleCode) continue
    const group = groups.get(session.moduleCode) ?? { code: session.moduleCode, name: session.moduleName, sessions: [] }
    group.sessions.push(session)
    groups.set(session.moduleCode, group)
  }
  return [...groups.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((g) => ({ ...g, sessions: [...g.sessions].sort((a, b) => a.start.localeCompare(b.start)) }))
}

/** Upcoming (not yet ended) and past sessions, upcoming soonest first, past latest first. */
export function splitByTime<T extends TimetableSession>(sessions: T[], now: Date): { upcoming: T[]; past: T[] } {
  const t = now.getTime()
  const endOf = (s: T) => new Date(s.end ?? s.start).getTime()
  return {
    upcoming: sessions.filter((s) => endOf(s) >= t).sort((a, b) => a.start.localeCompare(b.start)),
    past: sessions.filter((s) => endOf(s) < t).sort((a, b) => b.start.localeCompare(a.start)),
  }
}

export function countByStatus(sessions: { status: PrepStatus }[]): Record<PrepStatus, number> {
  const counts: Record<PrepStatus, number> = { red: 0, amber: 0, green: 0 }
  for (const s of sessions) counts[s.status] += 1
  return counts
}

export type AssignmentTab = 'upcoming' | 'pastDue' | 'completed' | 'history'

/**
 * Module sessions as Teams lists assignments. Upcoming: not handed in and
 * not over, soonest first. Past due: over and not handed in. Completed:
 * handed in, future ones included. History: past due and completed
 * together. All but Upcoming are most recent first, by session start.
 */
export function assignmentLists<T extends TimetableSession & { prepDone: boolean }>(
  sessions: T[],
  now: Date
): Record<AssignmentTab, T[]> {
  const coded = sessions.filter((s) => s.moduleCode)
  const latestFirst = (list: T[]) => [...list].sort((a, b) => b.start.localeCompare(a.start))
  const upcoming = coded
    .filter((s) => !s.prepDone && !hasEnded(s, now))
    .sort((a, b) => a.start.localeCompare(b.start))
  const pastDue = latestFirst(coded.filter((s) => !s.prepDone && hasEnded(s, now)))
  const completed = latestFirst(coded.filter((s) => s.prepDone))
  const history = latestFirst(coded.filter((s) => s.prepDone || hasEnded(s, now)))
  return { upcoming, pastDue, completed, history }
}
