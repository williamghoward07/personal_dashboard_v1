'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { RoutineInstance, Task } from '@/lib/types'
import type { DayItem, EventSpan } from './calendarItems'
import { isBarRenderedCalendarItem } from './calendarItems'
import { layoutBarsForWeek, laneCountForWeek } from './weekBarLayout'
import {
  GUTTER_PX,
  defaultScrollMinutes,
  gridHeightPx,
  minutesToPx,
  pillHeightPx,
  visualEndMinutes,
} from './time-grid/grid-math'
import { layoutOverlappingBlocks } from './time-grid/overlap-layout'
import { resolveTimedRange } from './time-grid/timed-range'
import TimeGridPill, { isTimedDayItem } from './time-grid/TimeGridPill'
import CurrentTimeLine, { useCurrentTimeMinutes } from './time-grid/CurrentTimeLine'
import { TimeGridHourLabels, TimeGridLines } from './time-grid/TimeGridChrome'
import UntimedItemRow from './time-grid/UntimedItemRow'
import { useScrollBox } from './time-grid/use-scroll-box'
import DayHeading from './DayHeading'

const LANE_PX = 20

const HOUR_LABEL_ROOM_PX = 8

function itemKey(item: DayItem): string {
  return `${item.kind}-${item.id}`
}

// Google Calendar's week layout: one bordered frame with a fixed header
// (day names, then an all-day band: spanning bars over per-day untimed
// items) above a 24h hour grid that scrolls and fills the rest of the
// height. The header is padded by the grid's scrollbar width so its seven
// columns line up with the ones that scroll. Each day's timed items get
// their own side-by-side overlap layout; the current-time line only
// appears in today's column.
export default function WeekGridView({
  weekKeys,
  itemsByDate,
  spans,
  todayKey,
  pxPerMin,
  onGridViewportHeight,
  onSelectDate,
  onSelectTask,
  onSelectRoutineInstance,
}: {
  weekKeys: string[]
  itemsByDate: Map<string, DayItem[]>
  spans: EventSpan[]
  todayKey: string
  pxPerMin: number
  onGridViewportHeight: (px: number) => void
  onSelectDate: (dateKey: string) => void
  onSelectTask: (task: Task) => void
  onSelectRoutineInstance: (instance: RoutineInstance) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { height: viewportPx, scrollbarPx } = useScrollBox(scrollRef)
  const nowMinutes = useCurrentTimeMinutes()
  const todayInWeek = weekKeys.includes(todayKey)

  const placedBars = useMemo(() => layoutBarsForWeek(weekKeys, spans), [weekKeys, spans])
  const laneCount = laneCountForWeek(placedBars)
  const untimedByDay = weekKeys.map((dateKey) =>
    (itemsByDate.get(dateKey) ?? []).filter((item) => !isTimedDayItem(item) && item.kind !== 'calendar')
  )
  const hasAllDayBand = laneCount > 0 || untimedByDay.some((items) => items.length > 0)
  const columns = `${GUTTER_PX}px repeat(${weekKeys.length}, minmax(0, 1fr))`

  useEffect(() => {
    if (viewportPx > 0) onGridViewportHeight(viewportPx)
  }, [viewportPx, onGridViewportHeight])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      // A little above the hour line, so that hour's label isn't clipped.
      top: minutesToPx(defaultScrollMinutes(todayInWeek, nowMinutes), pxPerMin) - HOUR_LABEL_ROOM_PX,
    })
    // Only re-run when the visible week or zoom level changes — the
    // current-time tick shouldn't yank the user's scroll position back
    // every minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKeys[0], pxPerMin])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-outline-variant/60">
      <div className="shrink-0 border-b border-outline-variant/60" style={{ paddingRight: scrollbarPx }}>
        <div className="grid" style={{ gridTemplateColumns: columns }}>
          <div />
          {weekKeys.map((dateKey) => (
            <DayHeading
              key={dateKey}
              dateKey={dateKey}
              isToday={dateKey === todayKey}
              onClick={() => onSelectDate(dateKey)}
              className="border-l border-outline-variant/20"
            />
          ))}
        </div>

        {hasAllDayBand && (
          <div
            className="grid max-h-40 overflow-y-auto pb-1"
            style={{
              gridTemplateColumns: columns,
              gridTemplateRows: `${laneCount > 0 ? `repeat(${laneCount}, ${LANE_PX}px) ` : ''}auto`,
            }}
          >
            {weekKeys.map((dateKey, col) => (
              <div
                key={`col-${dateKey}`}
                style={{ gridColumn: col + 2, gridRow: '1 / -1' }}
                className="border-l border-outline-variant/20"
              />
            ))}
            {placedBars.map((bar) => (
              <div
                key={bar.id}
                title={bar.title}
                style={{ gridColumn: `${bar.colStart + 2} / span ${bar.colSpan}`, gridRow: bar.lane + 1 }}
                className="mx-0.5 mt-0.5 truncate rounded border border-on-surface-variant/30 bg-on-surface-variant/15 px-1.5 text-[11px] font-medium leading-4 text-on-surface"
              >
                {bar.title}
              </div>
            ))}
            {untimedByDay.map((items, col) =>
              items.length > 0 ? (
                <div
                  key={`untimed-${weekKeys[col]}`}
                  style={{ gridColumn: col + 2, gridRow: laneCount + 1 }}
                  className="flex min-w-0 flex-col gap-0.5 px-0.5 pt-0.5"
                >
                  {items.map((item) => (
                    <UntimedItemRow key={itemKey(item)} item={item} onSelectTask={onSelectTask} />
                  ))}
                </div>
              ) : null
            )}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: gridHeightPx(pxPerMin) }}>
          <TimeGridHourLabels pxPerMin={pxPerMin} />
          <div className="relative flex flex-1">
            {weekKeys.map((dateKey) => {
              const isToday = dateKey === todayKey
              const timed = (itemsByDate.get(dateKey) ?? [])
                .filter(isTimedDayItem)
                .filter((item) => !isBarRenderedCalendarItem(item))
              const ranges = new Map(timed.map((item) => [itemKey(item), resolveTimedRange(item)]))
              const blocks = timed.map((item) => {
                const { startMinutes, endMinutes } = ranges.get(itemKey(item))!
                return { id: itemKey(item), startMinutes, endMinutes: visualEndMinutes(startMinutes, endMinutes, pxPerMin) }
              })
              const layouts = new Map(layoutOverlappingBlocks(blocks).map((l) => [l.id, l]))

              return (
                <div key={dateKey} className="relative min-w-0 flex-1 border-l border-outline-variant/20">
                  <TimeGridLines pxPerMin={pxPerMin} />
                  {isToday && <CurrentTimeLine nowMinutes={nowMinutes} pxPerMin={pxPerMin} />}
                  {timed.map((item) => {
                    const key = itemKey(item)
                    const range = ranges.get(key)
                    const layout = layouts.get(key)
                    if (!range || !layout) return null
                    return (
                      <TimeGridPill
                        key={key}
                        item={item}
                        top={minutesToPx(range.startMinutes, pxPerMin)}
                        height={pillHeightPx(range.startMinutes, range.endMinutes, pxPerMin)}
                        column={layout.column}
                        columnCount={layout.columnCount}
                        onSelectRoutineInstance={onSelectRoutineInstance}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
