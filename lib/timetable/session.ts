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

/** Red = no readings added; amber = some still to do; green = prepared. */
export type PrepStatus = 'red' | 'amber' | 'green'

export interface ReadingCount {
  done: number
  total: number
}

/** A session with what the user has recorded about it — the /api/timetable shape. */
export interface SessionWithPrep extends TimetableSession {
  readings: ReadingCount
  noReadings: boolean
  notesDone: boolean
  note: string | null
  status: PrepStatus
  /** The module workspace for `moduleCode`, if one exists. */
  workspaceId: string | null
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

export function prepStatus(readings: ReadingCount, noReadings: boolean): PrepStatus {
  if (readings.total === 0) return noReadings ? 'green' : 'red'
  return readings.done >= readings.total ? 'green' : 'amber'
}

export const PREP_LABEL: Record<PrepStatus, string> = {
  red: 'No readings added',
  amber: 'Readings to do',
  green: 'Prepared',
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

export function withPrep(
  sessions: TimetableSession[],
  {
    readings,
    states,
    workspaceByCode,
  }: {
    readings: Map<string, ReadingCount>
    states: Map<string, { no_readings: boolean; notes_done_at: string | null; note: string | null }>
    workspaceByCode: Map<string, string>
  }
): SessionWithPrep[] {
  return sessions.map((session) => {
    const count = readings.get(session.uid) ?? { done: 0, total: 0 }
    const state = states.get(session.uid)
    const noReadings = state?.no_readings ?? false
    return {
      ...session,
      readings: count,
      noReadings,
      notesDone: !!state?.notes_done_at,
      note: state?.note ?? null,
      status: prepStatus(count, noReadings),
      workspaceId: session.moduleCode ? (workspaceByCode.get(session.moduleCode) ?? null) : null,
    }
  })
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
