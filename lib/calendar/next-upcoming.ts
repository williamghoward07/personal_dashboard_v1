export interface UpcomingCandidate {
  kind: 'calendar' | 'task' | 'activity'
  id: string
  title: string
  allDay: boolean
  // A comparable ISO-shaped string: a full datetime for timed calendar
  // events and Strava-imported activities, a plain 'YYYY-MM-DD' date for
  // everything else (all-day events, tasks, manually-logged activities).
  // A date-only string always sorts correctly before a same-day timed one
  // via plain string comparison, since it's a prefix of any longer string
  // that starts with it.
  sortKey: string
}

// Pure: from raw upcoming-range data (already fetched for a window
// starting tomorrow), pick the single chronologically-next item across
// however many sources were merged in. Generic over the candidate shape
// so callers can carry extra fields through (e.g. the full Task, for a
// click-through) without this function needing to know about them.
// Returns null if there's nothing upcoming at all.
export function pickNextUpcoming<T extends { sortKey: string }>(candidates: T[]): T | null {
  if (candidates.length === 0) return null
  return candidates.slice().sort((a, b) => a.sortKey.localeCompare(b.sortKey))[0]
}
