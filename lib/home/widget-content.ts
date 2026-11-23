import { addDays, londonToday } from '@/lib/blackboard/dates'
import { dueWithin, workLists, type WorkItem } from '@/lib/blackboard/work'
import { londonDayBoundsUTC } from '@/lib/google/london-day'

export interface HomeWidgetDimensions {
  span?: number
  width?: number
  height?: number
}

type Density = 0 | 1 | 2

/** Width is measured by the frame. Span estimates it before the first measurement. */
export function widgetDensity({ width, height = 0, span = 1 }: HomeWidgetDimensions): Density {
  const availableWidth = width ?? span * 280
  if (availableWidth >= 760 || height >= 560) return 2
  if (availableWidth >= 480 || height >= 360) return 1
  return 0
}

export function calendarDateRange(today: string, days: number, offset = 0) {
  const startDateKey = addDays(today, offset)
  const endDateKey = addDays(startDateKey, days)
  const start = londonDayBoundsUTC(new Date(`${startDateKey}T12:00:00Z`))
  const last = londonDayBoundsUTC(new Date(`${addDays(endDateKey, -1)}T12:00:00Z`))
  return { startDateKey, endDateKey, timeMin: start.timeMin, timeMax: last.timeMax }
}

function isAssessment(item: WorkItem) {
  return item.source !== 'prep' && ['summative', 'formative', 'test'].includes(item.category)
}

export function studyPriorities(items: WorkItem[], now: Date) {
  const { upcoming, pastDue } = workLists(items, now)
  const soon = dueWithin(items, now, 7)
  const soonKeys = new Set(soon.map((item) => item.key))
  const isDeadline = (item: WorkItem) =>
    item.source === 'assignment' || item.source === 'key_date' || isAssessment(item)
  return {
    today: londonToday(now),
    deadlines: upcoming.filter((item) => item.dueOn && (isAssessment(item) || (isDeadline(item) && soonKeys.has(item.key)))),
    overdue: pastDue.filter((item) => item.dueOn && isDeadline(item)),
    // Next 7 days first, then later prep so the prep column can fill its space.
    prep: [
      ...soon.filter((item) => item.source === 'prep'),
      ...upcoming.filter((item) => item.source === 'prep' && item.dueOn && !soonKeys.has(item.key)),
    ],
  }
}

/** Width is measured by the frame; span estimates it before the first measurement. */
export function widgetWidth({ width, span = 1 }: HomeWidgetDimensions) {
  return width ?? span * 280
}

export interface CalendarAgendaLayout {
  /** Most day sections shown, counting today. */
  maxDays: number
  todayLimit: number
  dayLimit: number
}

/** Smallest card still shows ~5 days; more days and items as the card grows. */
export function calendarAgendaLayout(dimensions: HomeWidgetDimensions): CalendarAgendaLayout {
  const density = widgetDensity(dimensions)
  const height = dimensions.height ?? 0
  // A small card the user hasn't made taller stays short; taller cards earn more days.
  const maxDays = density === 0 && height < 480
    ? 3
    : Math.min(10, [5, 6, 8][density] + (height >= 640 ? 2 : height >= 480 ? 1 : 0))
  return { maxDays, todayLimit: [3, 4, 6][density], dayLimit: [2, 3, 4][density] }
}

/** Today always shows (empty is fine); then the next days that have something on. */
export function pickAgendaDays<T>(days: [string, T[]][], today: string, maxDays: number): [string, T[]][] {
  const sorted = days.filter(([date]) => date >= today).sort(([a], [b]) => a.localeCompare(b))
  const todayEntry = sorted.find(([date]) => date === today)
  const rest = sorted.filter(([date, items]) => date !== today && items.length > 0)
  return [todayEntry ?? [today, [] as T[]], ...rest].slice(0, maxDays)
}

export function priorityLayout(
  counts: { deadlines: number; prep: number },
  dimensions: HomeWidgetDimensions,
) {
  const density = widgetDensity(dimensions)
  const twoColumn = counts.deadlines > 0 && counts.prep > 0 && widgetWidth(dimensions) >= 600
  const deadlineCap = [5, 6, 8][density]
  const prepCap = twoColumn ? deadlineCap : [3, 4, 6][density]
  const prep = Math.min(counts.prep, prepCap)
  let deadlines = Math.min(counts.deadlines, deadlineCap)
  // Keep the columns roughly level rather than leaving blank space beside a short list.
  if (twoColumn && deadlines > prep + 2) deadlines = Math.max(prep + 2, 3)
  return { twoColumn, deadlines, prep, overdue: [1, 2, 4][density] }
}

const PREP_OVERFLOW_DAYS = 14

/** Unshown prep within the next fortnight only; the whole term's prep is noise. */
export function prepOverflowCount(prep: WorkItem[], shown: number, today: string) {
  const end = addDays(today, PREP_OVERFLOW_DAYS)
  return prep.slice(shown).filter((item) => item.dueOn && item.dueOn < end).length
}
