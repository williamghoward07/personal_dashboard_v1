import type { DayItem, EventSpan } from './calendarItems'
import { DOT_CLASS, formatTime } from './calendarItems'
import { layoutBarsForWeek, laneCountForWeek } from './weekBarLayout'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// One CSS grid per week: a full-height "cell" button per day (rows 1..N,
// stretched), then day-number / spanning-bar / compact-list rows placed
// explicitly on top of it. Letting grid track sizing do the layout (instead
// of hand-computed pixel offsets) is what makes a bar that crosses several
// days render as one continuous strip lining up exactly with each day
// column, regardless of how many items are in any given day's list.
export default function WeekRow({
  weekCells,
  itemsByDate,
  spans,
  todayKey,
  onSelectDate,
  minHeightClass,
  maxCompactItems,
  showWeekdayLabel,
}: {
  weekCells: (string | null)[]
  itemsByDate: Map<string, DayItem[]>
  spans: EventSpan[]
  todayKey: string
  onSelectDate: (dateKey: string) => void
  minHeightClass: string
  maxCompactItems: number
  showWeekdayLabel: boolean
}) {
  const placedBars = layoutBarsForWeek(weekCells, spans)
  const laneCount = laneCountForWeek(placedBars)
  const numberRow = showWeekdayLabel ? 2 : 1
  const firstBarRow = numberRow + 1
  const listRow = firstBarRow + laneCount
  const totalRows = listRow

  return (
    <div className="grid grid-cols-7 gap-1">
      {weekCells.map((dateKey, col) => {
        if (!dateKey) {
          return (
            <div
              key={`blank-${col}`}
              style={{ gridColumn: col + 1, gridRow: `1 / span ${totalRows}` }}
              className={`${minHeightClass} rounded-lg`}
            />
          )
        }

        const isToday = dateKey === todayKey
        return (
          <button
            key={`bg-${dateKey}`}
            type="button"
            onClick={() => onSelectDate(dateKey)}
            style={{ gridColumn: col + 1, gridRow: `1 / span ${totalRows}` }}
            className={`${minHeightClass} rounded-lg border text-left transition-colors duration-200 ${
              isToday
                ? 'border-secondary-container/50 bg-secondary-container/5'
                : 'border-outline-variant/60 hover:bg-surface-container-high'
            }`}
          />
        )
      })}

      {showWeekdayLabel &&
        weekCells.map((dateKey, col) => {
          if (!dateKey) return null
          return (
            <span
              key={`label-${dateKey}`}
              style={{ gridColumn: col + 1, gridRow: 1 }}
              className="pointer-events-none px-1.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant"
            >
              {WEEKDAY_LABELS[col]}
            </span>
          )
        })}

      {weekCells.map((dateKey, col) => {
        if (!dateKey) return null
        const isToday = dateKey === todayKey
        return (
          <span
            key={`num-${dateKey}`}
            style={{ gridColumn: col + 1, gridRow: numberRow }}
            className={`pointer-events-none px-1.5 ${showWeekdayLabel ? 'pt-0.5' : 'pt-1.5'} text-xs font-semibold tabular-nums ${
              isToday ? 'text-secondary-container' : showWeekdayLabel ? 'text-on-surface' : 'text-on-surface-variant'
            }`}
          >
            {Number(dateKey.slice(-2))}
          </span>
        )
      })}

      {placedBars.map((bar) => (
        <div
          key={bar.id}
          style={{ gridColumn: `${bar.colStart + 1} / span ${bar.colSpan}`, gridRow: firstBarRow + bar.lane }}
          className="pointer-events-none mx-1.5 mt-1 truncate rounded border border-on-surface-variant/30 bg-on-surface-variant/15 px-1 text-[10px] font-medium leading-4 text-on-surface"
        >
          {bar.title}
        </div>
      ))}

      {weekCells.map((dateKey, col) => {
        if (!dateKey) return null
        // All-day events (single- or multi-day) render as bars above, not
        // here — otherwise they'd show up twice.
        const items = (itemsByDate.get(dateKey) ?? []).filter(
          (item) => !(item.kind === 'calendar' && item.allDay)
        )
        return (
          <ul
            key={`list-${dateKey}`}
            style={{ gridColumn: col + 1, gridRow: listRow }}
            className="pointer-events-none flex flex-col gap-0.5 px-1.5 pb-1.5 pt-1"
          >
            {items.slice(0, maxCompactItems).map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex items-center gap-1 truncate text-[11px] text-on-surface">
                <span className={`h-1 w-1 shrink-0 rounded-full ${DOT_CLASS[item.kind]}`} />
                {item.kind === 'calendar' && item.start && (
                  <span className="shrink-0 tabular-nums text-on-surface-variant">{formatTime(item.start)}</span>
                )}
                <span className="truncate">{item.title}</span>
              </li>
            ))}
            {items.length > maxCompactItems && (
              <li className="text-[11px] text-on-surface-variant">+{items.length - maxCompactItems} more</li>
            )}
          </ul>
        )
      })}
    </div>
  )
}
