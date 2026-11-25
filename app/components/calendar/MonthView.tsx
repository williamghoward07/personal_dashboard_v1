'use client'

import { useRef } from 'react'
import type { DayItem, EventSpan } from './calendarItems'
import { useScrollBox } from './time-grid/use-scroll-box'
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
  selectedDateKey,
  onSelectDate,
}: {
  year: number
  month: number
  itemsByDate: Map<string, DayItem[]>
  spans: EventSpan[]
  todayKey: string
  selectedDateKey: string
  onSelectDate: (dateKey: string) => void
}) {
  const cells = buildMonthCells(year, month)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  const weeksRef = useRef<HTMLDivElement>(null)
  const { height: weeksPx } = useScrollBox(weeksRef)
  // The weeks share the height left under the weekday header equally, as in
  // Google Calendar; each cell lists as many items as fit. Until measured
  // (first paint) the rows keep their natural height and three items.
  const rowPx = weeksPx > 0 ? weeksPx / weeks.length : undefined

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low">
      <div className="grid shrink-0 grid-cols-7 border-b border-outline-variant bg-surface-container/60 text-center text-xs font-semibold text-on-surface-variant">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>
      <div
        ref={weeksRef}
        className="grid min-h-0 flex-1 divide-y divide-outline-variant"
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
            selectedDateKey={selectedDateKey}
            rowHeightPx={rowPx}
          />
        ))}
      </div>
    </div>
  )
}
