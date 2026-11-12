'use client'

import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { RoutineInstance, Task } from '@/lib/types'
import type { DayItem } from './calendarItems'
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

const HOUR_LABEL_ROOM_PX = 8

function itemKey(item: DayItem): string {
  return `${item.kind}-${item.id}`
}

// Full 24h scrollable hour grid for a single day: an untimed strip (all-day
// events, tasks, activity sessions — none of which carry a time-of-day in
// the current data model) above the grid, side-by-side overlap columns for
// same-time timed items, and a current-time line when showing today.
export default function DayGridView({
  dateKey,
  items,
  isToday,
  pxPerMin,
  onGridViewportHeight,
  onSelectTask,
  onSelectRoutineInstance,
  headerAction,
}: {
  dateKey: string
  items: DayItem[]
  isToday: boolean
  pxPerMin: number
  onGridViewportHeight: (px: number) => void
  onSelectTask: (task: Task) => void
  onSelectRoutineInstance: (instance: RoutineInstance) => void
  /** Right of the day heading (e.g. Auto time-block today). */
  headerAction?: ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { height: viewportPx } = useScrollBox(scrollRef)
  const nowMinutes = useCurrentTimeMinutes()

  useEffect(() => {
    if (viewportPx > 0) onGridViewportHeight(viewportPx)
  }, [viewportPx, onGridViewportHeight])

  const untimed = useMemo(() => items.filter((item) => !isTimedDayItem(item)), [items])
  const timed = useMemo(() => items.filter(isTimedDayItem), [items])

  const ranges = useMemo(() => new Map(timed.map((item) => [itemKey(item), resolveTimedRange(item)])), [timed])
  const layouts = useMemo(() => {
    const blocks = timed.map((item) => {
      const { startMinutes, endMinutes } = ranges.get(itemKey(item))!
      return { id: itemKey(item), startMinutes, endMinutes: visualEndMinutes(startMinutes, endMinutes, pxPerMin) }
    })
    return new Map(layoutOverlappingBlocks(blocks).map((l) => [l.id, l]))
  }, [timed, ranges, pxPerMin])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      // A little above the hour line, so that hour's label isn't clipped.
      top: minutesToPx(defaultScrollMinutes(isToday, nowMinutes), pxPerMin) - HOUR_LABEL_ROOM_PX,
    })
    // Only re-run when the visible day or zoom level changes — the
    // current-time tick shouldn't yank the user's scroll position back
    // every minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, pxPerMin])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-outline-variant/60">
      <div className="shrink-0 border-b border-outline-variant/60">
        <div className="flex items-center pr-2">
          <div style={{ width: GUTTER_PX }} className="shrink-0" />
          <DayHeading dateKey={dateKey} isToday={isToday} className="flex-1 justify-start px-2" />
          {headerAction}
        </div>
        {untimed.length > 0 && (
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pb-1.5 pr-2" style={{ paddingLeft: GUTTER_PX }}>
            {untimed.map((item) => (
              <UntimedItemRow key={itemKey(item)} item={item} onSelectTask={onSelectTask} />
            ))}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: gridHeightPx(pxPerMin) }}>
          <TimeGridHourLabels pxPerMin={pxPerMin} />
          <div className="relative flex-1">
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
        </div>
      </div>
    </div>
  )
}
