'use client'

import type { CSSProperties } from 'react'
import type { RoutineInstance } from '@/lib/types'
import type { DayItem } from '../calendarItems'
import { formatTime, sessionColour } from '../calendarItems'
import PrepLight from '../../lectures/PrepLight'
import { useOpenSession } from '../../lectures/SessionPopover'

// Intersected with allDay:false/start:string (not just the bare 'calendar'
// variant) so a negated `.filter((item) => !isTimedDayItem(item))` narrows
// correctly — an all-day calendar item is structurally excluded from this
// type, not just excluded by the runtime check below.
export type TimedDayItem =
  | (Extract<DayItem, { kind: 'calendar' }> & { allDay: false; start: string })
  | Extract<DayItem, { kind: 'routine' }>
  | Extract<DayItem, { kind: 'session' }>

export function isTimedDayItem(item: DayItem): item is TimedDayItem {
  return (
    (item.kind === 'calendar' && !item.allDay && item.start !== null) || item.kind === 'routine' || item.kind === 'session'
  )
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
  const openSession = useOpenSession()
  const start = item.start
  const colour = item.kind === 'routine' ? item.colour : item.kind === 'session' ? sessionColour(item.session) : null
  const widthPct = 100 / columnCount
  const leftPct = column * widthPct

  const style: CSSProperties = {
    top,
    height,
    left: `calc(${leftPct}% + 2px)`,
    width: `calc(${widthPct}% - 4px)`,
    // Routine colours are hex (alpha suffix); a session's is a CSS variable.
    backgroundColor:
      item.kind === 'session'
        ? `color-mix(in srgb, ${colour} 16%, transparent)`
        : colour
          ? `${colour}33`
          : 'color-mix(in srgb, var(--color-secondary-container) 16%, transparent)',
    borderColor: colour ?? 'var(--color-secondary-container)',
  }

  const content = (
    <>
      <span className="font-semibold">{formatTime(start)}</span> {item.title}
    </>
  )

  if (item.kind === 'session') {
    return (
      <button
        type="button"
        onClick={(e) => openSession?.(item.session, e.currentTarget)}
        style={style}
        className="absolute flex cursor-pointer items-start gap-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] text-on-surface"
      >
        <PrepLight status={item.session.status} notesDone={item.session.notesDone} size="sm" className="mt-1" />
        <span className="min-w-0">{content}</span>
      </button>
    )
  }

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
