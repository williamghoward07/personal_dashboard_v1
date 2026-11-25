'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { RoutineInstance, Task } from '@/lib/types'
import type { DayItem, EventSpan } from './calendarItems'
import { formatDayHeading, isBarRenderedCalendarItem } from './calendarItems'
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

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function itemKey(item: DayItem): string {
  return `${item.kind}-${item.id}`
}

// Full 24h scrollable hour grid across seven day columns, sharing one hour
// gutter. All-day events render as spanning bars above the grid (reusing
// the same lane-packing Month/Week's compact view already uses), each
// day's timed items get their own independent side-by-side overlap layout,
// and the current-time line only appears in today's column, if visible.
export default function WeekGridView({
  weekKeys,
  itemsByDate,
  spans,
  todayKey,
  pxPerMin,
  maxContainerHeightPx,
  onSelectDate,
  onSelectTask,
  onSelectRoutineInstance,
}: {
  weekKeys: string[]
  itemsByDate: Map<string, DayItem[]>
  spans: EventSpan[]
  todayKey: string
  pxPerMin: number
  maxContainerHeightPx: number
  onSelectDate: (dateKey: string) => void
  onSelectTask: (task: Task) => void
  onSelectRoutineInstance: (instance: RoutineInstance) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const nowMinutes = useCurrentTimeMinutes()
  const todayInWeek = weekKeys.includes(todayKey)

  const placedBars = useMemo(() => layoutBarsForWeek(weekKeys, spans), [weekKeys, spans])
  const laneCount = laneCountForWeek(placedBars)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: minutesToPx(defaultScrollMinutes(todayInWeek, nowMinutes), pxPerMin) })
    // Only re-run when the visible week or zoom level changes — the
    // current-time tick shouldn't yank the user's scroll position back
    // every minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKeys[0], pxPerMin])

  return (
    <div className="min-w-0 overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-low">
      <div className="min-w-[42rem]">
        <div className="flex bg-surface-container/60 [scrollbar-gutter:stable] overflow-y-hidden">
          <div style={{ width: GUTTER_PX }} className="shrink-0" />
          {weekKeys.map((dateKey, i) => {
            const isToday = dateKey === todayKey
            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => onSelectDate(dateKey)}
                aria-label={formatDayHeading(dateKey)}
                aria-current={isToday ? 'date' : undefined}
                className="flex-1 border-r border-outline-variant px-1 py-1.5 text-center transition-colors last:border-r-0 hover:bg-surface-container-high focus-visible:-outline-offset-2"
              >
                <span className={`inline-flex min-w-11 flex-col rounded-md px-2 py-1 text-xs font-semibold leading-4 ${
                  isToday ? 'bg-primary-container/16 text-primary' : 'text-on-surface'
                }`}>
                  <span className="text-[11px] font-medium">{WEEKDAY_LABELS[i]}</span>
                  <span className="tabular-nums">{Number(dateKey.slice(-2))}</span>
                </span>
              </button>
            )
          })}
        </div>

        {laneCount > 0 && (
          <div className="flex overflow-y-hidden pt-1 [scrollbar-gutter:stable]">
            <div style={{ width: GUTTER_PX }} className="shrink-0" />
            <div className="flex flex-1" style={{ minHeight: laneCount * 20 }}>
              {weekKeys.map((_, col) => (
                <div key={col} className="relative flex-1" style={{ height: laneCount * 20 }}>
                  {placedBars
                    .filter((bar) => bar.colStart === col)
                    .map((bar) => (
                      <div
                        key={bar.id}
                        style={{
                          top: bar.lane * 20,
                          width: `calc(${bar.colSpan * 100}% - 4px)`,
                        }}
                        className="absolute left-0.5 truncate rounded bg-habit-purple/16 px-1.5 text-[11px] font-medium leading-4 text-on-surface"
                      >
                        {bar.title}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex overflow-y-hidden [scrollbar-gutter:stable]">
          <div style={{ width: GUTTER_PX }} className="shrink-0" />
          {weekKeys.map((dateKey) => {
            const items = (itemsByDate.get(dateKey) ?? []).filter(
              (item) => !isTimedDayItem(item) && item.kind !== 'calendar'
            )
            return (
              <div key={dateKey} className="flex min-w-0 flex-1 flex-col gap-0.5 px-0.5">
                {items.map((item) => (
                  <UntimedItemRow key={itemKey(item)} item={item} onSelectTask={onSelectTask} />
                ))}
              </div>
            )
          })}
        </div>

        <div
          ref={scrollRef}
          className="relative overflow-y-auto border-t border-outline-variant [scrollbar-gutter:stable]"
          style={{ height: Math.min(maxContainerHeightPx, gridHeightPx(pxPerMin)) }}
        >
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
                  <div key={dateKey} className={`relative min-w-0 flex-1 border-r border-outline-variant/60 last:border-r-0 ${isToday ? 'bg-primary-container/4' : ''}`}>
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
    </div>
  )
}
