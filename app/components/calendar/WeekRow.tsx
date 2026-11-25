import type { DayItem, EventSpan } from './calendarItems'
import { DEADLINE_DONE_CLASS, deadlineTime, dotClassFor, formatDayHeading, formatTime, isBarRenderedCalendarItem } from './calendarItems'
import { layoutBarsForWeek, laneCountForWeek } from './weekBarLayout'
import PrepLight from '../lectures/PrepLight'

const DEFAULT_COMPACT_ITEMS = 3
// Month view filling the window: how many item lines fit a row of a given
// height. Day-number row (size-5 + margins), a bar lane (leading-4 + mb-0.5),
// the list's bottom padding, and 16px per item line with a 2px gap.
const NUMBER_ROW_PX = 32
const BAR_LANE_PX = 18
const LIST_PADDING_PX = 6
const ITEM_LINE_PX = 16
const ITEM_GAP_PX = 2

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
  maxCompactItems = DEFAULT_COMPACT_ITEMS,
  rowHeightPx,
}: {
  weekCells: (string | null)[]
  itemsByDate: Map<string, DayItem[]>
  spans: EventSpan[]
  todayKey: string
  onSelectDate: (dateKey: string) => void
  selectedDateKey: string
  /** Items a day lists before "+N more", when the row's height isn't fixed. */
  maxCompactItems?: number
  /** When the row's height is fixed (month view filling the window), list as many items as fit in it. */
  rowHeightPx?: number
}) {
  const placedBars = layoutBarsForWeek(weekCells, spans)
  const laneCount = laneCountForWeek(placedBars)
  const firstBarRow = 2
  const listRow = firstBarRow + laneCount
  const totalRows = listRow
  // A fixed-height row (month filling the window) sizes its cells itself.
  const minHeight = rowHeightPx ? 'min-h-0' : 'min-h-17 sm:min-h-24'
  const lineBudget = rowHeightPx
    ? Math.max(
        1,
        Math.floor(
          (rowHeightPx - NUMBER_ROW_PX - laneCount * BAR_LANE_PX - LIST_PADDING_PX + ITEM_GAP_PX) /
            (ITEM_LINE_PX + ITEM_GAP_PX)
        )
      )
    : null
  // How many items a day lists before "+N more". With a line budget the
  // "+N more" line itself takes one of the lines.
  const shownCount = (total: number) =>
    lineBudget === null ? maxCompactItems : total > lineBudget ? Math.max(0, lineBudget - 1) : lineBudget

  return (
    <div
      className={`grid grid-cols-7 ${rowHeightPx ? 'h-full overflow-hidden' : ''}`}
      // Date and bar rows hug their content; the item list takes the rest,
      // so a row stretched to fill the month grows its list, not its date.
      style={{ gridTemplateRows: `repeat(${listRow - 1}, auto) minmax(0, 1fr)` }}
    >
      {weekCells.map((dateKey, col) => {
        if (!dateKey) {
          return (
            <div
              key={`blank-${col}`}
              style={{ gridColumn: col + 1, gridRow: `1 / span ${totalRows}` }}
              className={`${minHeight} border-outline-variant bg-surface-container/35 ${col < 6 ? 'border-r' : ''}`}
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
            className={`${minHeight} border-outline-variant transition-colors ${col < 6 ? 'border-r' : ''} focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
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
            className="pointer-events-none flex min-h-0 min-w-0 flex-col gap-0.5 overflow-hidden px-1 pb-1.5 sm:px-1.5"
          >
            {items.slice(0, shownCount(items.length)).map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex min-w-0 items-center gap-1 truncate text-[10px] leading-4 text-on-surface sm:text-[11px]">
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
            {items.length > shownCount(items.length) && (
              <li className="text-[11px] leading-4 text-on-surface-variant">+{items.length - shownCount(items.length)}<span className="hidden sm:inline"> more</span></li>
            )}
          </ul>
        )
      })}
    </div>
  )
}
