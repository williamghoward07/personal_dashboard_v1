'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { RoutineInstance, Task } from '@/lib/types'
import type { DayItem } from './calendarItems'
import { GRID_HEIGHT_PX, defaultScrollMinutes, minutesToPx } from './time-grid/grid-math'
import { layoutOverlappingBlocks } from './time-grid/overlap-layout'
import { resolveTimedRange } from './time-grid/timed-range'
import TimeGridPill, { isTimedDayItem } from './time-grid/TimeGridPill'
import CurrentTimeLine, { useCurrentTimeMinutes } from './time-grid/CurrentTimeLine'
import { TimeGridHourLabels, TimeGridLines } from './time-grid/TimeGridChrome'
import UntimedItemRow from './time-grid/UntimedItemRow'

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
  onSelectTask,
  onSelectRoutineInstance,
}: {
  dateKey: string
  items: DayItem[]
  isToday: boolean
  onSelectTask: (task: Task) => void
  onSelectRoutineInstance: (instance: RoutineInstance) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const nowMinutes = useCurrentTimeMinutes()

  const untimed = useMemo(() => items.filter((item) => !isTimedDayItem(item)), [items])
  const timed = useMemo(() => items.filter(isTimedDayItem), [items])

  const ranges = useMemo(() => new Map(timed.map((item) => [itemKey(item), resolveTimedRange(item)])), [timed])
  const layouts = useMemo(() => {
    const blocks = timed.map((item) => ({ id: itemKey(item), ...ranges.get(itemKey(item))! }))
    return new Map(layoutOverlappingBlocks(blocks).map((l) => [l.id, l]))
  }, [timed, ranges])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: minutesToPx(defaultScrollMinutes(isToday, nowMinutes)) })
    // Only re-run when the visible day changes — the current-time tick
    // shouldn't yank the user's scroll position back every minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey])

  return (
    <div className="flex flex-col gap-2">
      {untimed.length > 0 && (
        <div className="flex flex-col gap-1 border-b border-outline-variant/60 pb-2">
          {untimed.map((item) => (
            <UntimedItemRow key={itemKey(item)} item={item} onSelectTask={onSelectTask} />
          ))}
        </div>
      )}

      <div
        ref={scrollRef}
        className="relative overflow-y-auto rounded-lg border border-outline-variant/60"
        style={{ height: 480 }}
      >
        <div className="relative flex" style={{ height: GRID_HEIGHT_PX }}>
          <TimeGridHourLabels />
          <div className="relative flex-1">
            <TimeGridLines />
            {isToday && <CurrentTimeLine nowMinutes={nowMinutes} />}
            {timed.map((item) => {
              const key = itemKey(item)
              const range = ranges.get(key)
              const layout = layouts.get(key)
              if (!range || !layout) return null
              return (
                <TimeGridPill
                  key={key}
                  item={item}
                  top={minutesToPx(range.startMinutes)}
                  height={minutesToPx(range.endMinutes - range.startMinutes)}
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
