import { isoWeekday } from './schedule'

export interface HeatmapCell {
  date: string
  isFuture: boolean
}

const WEEKS = 14
const DAYS = 7
const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const HEATMAP_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function dateKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function keyToUTCDate(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function addUTCDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

// Calendar-aligned (Monday-first) weeks — deliberately not "trailing 98
// days counting back from today", which is what this used to be. Without
// alignment, a fixed row index doesn't mean the same weekday from one
// column to the next, which would make both day-of-week row labels and
// month-boundary column labels meaningless.
//
// All arithmetic here is UTC-based (Date.UTC / setUTCDate / string
// comparison for isFuture) rather than mixing in local-time methods like
// setHours/setDate — those are resolved in the *local* timezone, so on a
// machine running ahead of UTC (BST, CET, ...) `setHours(0,0,0,0)` then
// `.toISOString()` silently rolls back to the previous UTC day. Staying
// UTC-only end to end avoids that regardless of where this runs.
// referenceDate defaults to now but is a parameter so this stays a pure,
// deterministically testable function rather than reading the wall clock
// itself.
export function buildDateGrid(referenceDate: Date = new Date()): HeatmapCell[][] {
  const todayKey = dateKeyOf(referenceDate)
  const todayUTC = keyToUTCDate(todayKey)

  const daysSinceMonday = isoWeekday(todayKey) - 1
  const currentWeekMondayUTC = addUTCDays(todayUTC, -daysSinceMonday)
  const gridStartUTC = addUTCDays(currentWeekMondayUTC, -(WEEKS - 1) * DAYS)

  const grid: HeatmapCell[][] = []
  for (let w = 0; w < WEEKS; w++) {
    const week: HeatmapCell[] = []
    for (let d = 0; d < DAYS; d++) {
      const cellKey = dateKeyOf(addUTCDays(gridStartUTC, w * DAYS + d))
      week.push({ date: cellKey, isFuture: cellKey > todayKey })
    }
    grid.push(week)
  }
  return grid
}

// One label per column, populated only where that column's first day (a
// Monday) falls in a different month than the previous column's — the
// standard GitHub-contribution-graph convention. The first column always
// gets a label since there's no previous column to compare against.
export function monthLabelsForGrid(grid: HeatmapCell[][]): (string | null)[] {
  let lastMonth = -1
  return grid.map((week) => {
    const month = Number(week[0].date.slice(5, 7)) - 1
    if (month === lastMonth) return null
    lastMonth = month
    return MONTH_ABBREV[month]
  })
}
