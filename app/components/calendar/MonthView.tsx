import type { DayItem, EventSpan } from './calendarItems'
import WeekRow from './WeekRow'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function buildMonthCells(year: number, month: number): (string | null)[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay() // 0=Sun..6=Sat
  const leading = firstWeekday === 0 ? 6 : firstWeekday - 1 // Monday-first offset
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const cells: (string | null)[] = Array(leading).fill(null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${pad(month)}-${pad(day)}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function MonthView({
  year,
  month,
  itemsByDate,
  spans,
  todayKey,
  onSelectDate,
}: {
  year: number
  month: number
  itemsByDate: Map<string, DayItem[]>
  spans: EventSpan[]
  todayKey: string
  onSelectDate: (dateKey: string) => void
}) {
  const cells = buildMonthCells(year, month)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-on-surface-variant">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {weeks.map((week, i) => (
          <WeekRow
            key={i}
            weekCells={week}
            itemsByDate={itemsByDate}
            spans={spans}
            todayKey={todayKey}
            onSelectDate={onSelectDate}
            minHeightClass="min-h-24"
            maxCompactItems={3}
            showWeekdayLabel={false}
          />
        ))}
      </div>
    </div>
  )
}
