import type { DayItem, EventSpan } from './calendarItems'
import { DEADLINE_DONE_CLASS, deadlineTime, dotClassFor, formatDayHeading, formatTime, isBarRenderedCalendarItem } from './calendarItems'
import { layoutBarsForWeek, laneCountForWeek } from './weekBarLayout'
import PrepLight from '../lectures/PrepLight'

const MAX_COMPACT_ITEMS = 3

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
  selectedDateKey,
}: {
  weekCells: (string | null)[]
  itemsByDate: Map<string, DayItem[]>
  spans: EventSpan[]
  todayKey: string
  onSelectDate: (dateKey: string) => void
  selectedDateKey: string
}) {
  const placedBars = layoutBarsForWeek(weekCells, spans)
  const laneCount = laneCountForWeek(placedBars)
  const firstBarRow = 2
  const listRow = firstBarRow + laneCount
  const totalRows = listRow

  return (
    <div className="grid grid-cols-7">
      {weekCells.map((dateKey, col) => {
        if (!dateKey) {
          return (
            <div
              key={`blank-${col}`}
              style={{ gridColumn: col + 1, gridRow: `1 / span ${totalRows}` }}
              className={`min-h-17 border-outline-variant bg-surface-container/35 sm:min-h-24 ${col < 6 ? 'border-r' : ''}`}
            />
          )
        }

        const isSelected = dateKey === selectedDateKey
        return (
          <button
            key={`bg-${dateKey}`}
            type="button"
            onClick={() => onSelectDate(dateKey)}
            aria-label={formatDayHeading(dateKey)}
            aria-pressed={isSelected}
            aria-current={dateKey === todayKey ? 'date' : undefined}
            style={{ gridColumn: col + 1, gridRow: `1 / span ${totalRows}` }}
            className={`min-h-17 border-outline-variant transition-colors ${col < 6 ? 'border-r' : ''} focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:min-h-24 ${
              isSelected ? 'bg-primary-container/12' : 'hover:bg-surface-container-high'
            }`}
          />
        )
      })}

      {weekCells.map((dateKey, col) => {
        if (!dateKey) return null
        const isToday = dateKey === todayKey
        return (
          <span
            key={`num-${dateKey}`}
            style={{ gridColumn: col + 1, gridRow: 1 }}
            aria-hidden="true"
            className={`pointer-events-none m-1 grid size-5 place-items-center rounded-full text-[11px] font-semibold tabular-nums sm:m-1.5 ${
              isToday ? 'bg-primary-container text-on-primary-container' : 'text-on-surface'
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
          className="pointer-events-none mx-1 mb-0.5 truncate rounded bg-habit-purple/16 px-1 text-[10px] font-medium leading-4 text-on-surface"
        >
          {bar.title}
        </div>
      ))}

      {weekCells.map((dateKey, col) => {
        if (!dateKey) return null
        // Events rendered as a spanning bar above (all-day, or a timed
        // event crossing multiple days) are excluded here — otherwise
        // they'd show up twice.
        const items = (itemsByDate.get(dateKey) ?? []).filter(
          (item) => !isBarRenderedCalendarItem(item)
        )
        return (
          <ul
            key={`list-${dateKey}`}
            style={{ gridColumn: col + 1, gridRow: listRow }}
            className="pointer-events-none min-w-0 flex flex-col gap-0.5 px-1 pb-1.5 sm:px-1.5"
          >
            {items.slice(0, MAX_COMPACT_ITEMS).map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex min-w-0 items-center gap-1 truncate text-[10px] text-on-surface sm:text-[11px]">
                {item.kind === 'session' ? (
                  <PrepLight status={item.session.status} postStatus={item.session.postStatus} size="sm" />
                ) : (
                  <span
                    className={item.kind === 'routine' ? 'h-1 w-1 shrink-0 rounded-full' : `h-1 w-1 shrink-0 rounded-full ${dotClassFor(item)}`}
                    style={item.kind === 'routine' ? { backgroundColor: item.colour } : undefined}
                  />
                )}
                {(item.kind === 'calendar' || item.kind === 'routine' || item.kind === 'session') && item.start && (
                  <span className="hidden shrink-0 tabular-nums text-on-surface-variant md:inline">{formatTime(item.start)}</span>
                )}
                {item.kind === 'deadline' && deadlineTime(item.item) && (
                  <span className="hidden shrink-0 tabular-nums text-on-surface-variant md:inline">{deadlineTime(item.item)}</span>
                )}
                <span className={item.kind === 'deadline' && item.item.done ? `truncate ${DEADLINE_DONE_CLASS}` : 'truncate'}>
                  {item.title}
                </span>
              </li>
            ))}
            {items.length > MAX_COMPACT_ITEMS && (
              <li className="text-[11px] text-on-surface-variant">+{items.length - MAX_COMPACT_ITEMS}<span className="hidden sm:inline"> more</span></li>
            )}
          </ul>
        )
      })}
    </div>
  )
}
