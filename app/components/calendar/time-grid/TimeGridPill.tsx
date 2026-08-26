'use client'

import type { CSSProperties } from 'react'
import type { RoutineInstance } from '@/lib/types'
import type { DayItem } from '../calendarItems'
import { formatTime } from '../calendarItems'

// Intersected with allDay:false/start:string (not just the bare 'calendar'
// variant) so a negated `.filter((item) => !isTimedDayItem(item))` narrows
// correctly — an all-day calendar item is structurally excluded from this
// type, not just excluded by the runtime check below.
export type TimedDayItem =
  | (Extract<DayItem, { kind: 'calendar' }> & { allDay: false; start: string })
  | Extract<DayItem, { kind: 'routine' }>

export function isTimedDayItem(item: DayItem): item is TimedDayItem {
  return (item.kind === 'calendar' && !item.allDay && item.start !== null) || item.kind === 'routine'
}

export default function TimeGridPill({
  item,
  top,
  height,
  column,
  columnCount,
  onSelectRoutineInstance,
}: {
  item: TimedDayItem
  top: number
  height: number
  column: number
  columnCount: number
  onSelectRoutineInstance: (instance: RoutineInstance) => void
}) {
  const start = item.start
  const colour = item.kind === 'routine' ? item.colour : null
  const widthPct = 100 / columnCount
  const leftPct = column * widthPct

  const style: CSSProperties = {
    top,
    height,
    left: `calc(${leftPct}% + 2px)`,
    width: `calc(${widthPct}% - 4px)`,
    backgroundColor: colour ? `${colour}33` : 'rgba(20,209,255,0.16)',
    borderColor: colour ?? 'var(--color-secondary-container)',
  }

  const content = (
    <>
      <span className="font-semibold">{formatTime(start)}</span> {item.title}
    </>
  )

  if (item.kind === 'routine') {
    return (
      <button
        type="button"
        onClick={() => onSelectRoutineInstance(item.instance)}
        style={style}
        className="absolute cursor-pointer overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] text-on-surface"
      >
        {content}
      </button>
    )
  }

  return (
    <div style={style} className="absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] text-on-surface">
      {content}
    </div>
  )
}
