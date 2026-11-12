'use client'

import { useRef } from 'react'
import type { DayItem, EventSpan } from './calendarItems'
import { useScrollBox } from './time-grid/use-scroll-box'
import WeekRow from './WeekRow'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ROW_GAP_PX = 4

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

// Whole Monday-first weeks covering the month, as Google Calendar shows
// it: the first and last rows are filled with the neighbouring months'
// days rather than left blank.
function buildMonthCells(year: number, month: number): string[] {
  const first = `${year}-${pad(month)}-01`
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay() // 0=Sun..6=Sat
  const leading = firstWeekday === 0 ? 6 : firstWeekday - 1
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const total = Math.ceil((leading + daysInMonth) / 7) * 7
  return Array.from({ length: total }, (_, i) => shiftKey(first, i - leading))
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
  const monthPrefix = `${year}-${pad(month)}-`
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  const weeksRef = useRef<HTMLDivElement>(null)
  const { height: weeksPx } = useScrollBox(weeksRef)
  // The weeks share the height left under the weekday header equally, as
  // in Google Calendar; each cell lists as many items as fit.
  const rowPx = weeksPx > 0 ? (weeksPx - ROW_GAP_PX * (weeks.length - 1)) / weeks.length : undefined

  return (
    <div className="flex h-full min-h-0 flex-col gap-1">
      <div className="grid shrink-0 grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>
      <div
        ref={weeksRef}
        className="grid min-h-0 flex-1 gap-1"
        style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}
      >
        {weeks.map((week, i) => (
          <WeekRow
            key={i}
            weekCells={week}
            itemsByDate={itemsByDate}
            spans={spans}
            todayKey={todayKey}
            onSelectDate={onSelectDate}
            minHeightClass="min-h-20"
            maxCompactItems={3}
            rowHeightPx={rowPx}
            isDimmed={(dateKey) => !dateKey.startsWith(monthPrefix)}
            showWeekdayLabel={false}
          />
        ))}
      </div>
    </div>
  )
}
