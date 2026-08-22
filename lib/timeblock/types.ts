// Minutes since today's London midnight. Can exceed 1440 to represent a
// time on the following calendar day (e.g. an overnight bedtime) — see
// resolveWindow/splitDayOffset in time.ts for the rollover handling.
export interface MinuteInterval {
  startMinutes: number
  endMinutes: number
}

export interface BusyInterval extends MinuteInterval {
  id: string
  title: string
}

// A user-typed anchor that isn't (yet) a real calendar event — used as an
// extra constraint for this run only, never written to Google Calendar.
export interface KeyEventInput {
  title: string
  startTime: string // HH:mm
  endTime: string // HH:mm
}

export interface TimeBlockCandidateItem {
  id: string
  source: 'todo' | 'education_task'
  title: string
}

export interface PlacedBlock {
  candidate: TimeBlockCandidateItem
  startMinutes: number
  endMinutes: number
  // The containing free gap's own end — the furthest a duration edit can
  // push endMinutes without crossing into the next immovable interval.
  gapEndMinutes: number
}

export interface PlacementResult {
  placed: PlacedBlock[]
  unplaced: TimeBlockCandidateItem[]
}
