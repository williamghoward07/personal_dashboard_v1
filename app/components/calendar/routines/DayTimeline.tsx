'use client'

import { useDroppable } from '@dnd-kit/core'
import type { RoutineInstance, Task } from '@/lib/types'
import type { DayItem } from '../calendarItems'
import { formatTime } from '../calendarItems'

const START_HOUR = 6
const END_HOUR = 23
const SLOT_MINUTES = 15
const PX_PER_MIN = 1.2
const GRID_HEIGHT = (END_HOUR - START_HOUR) * 60 * PX_PER_MIN
const GUTTER_PX = 44

// Regular Google Calendar events reach this view only as a DayItem, which
// (unlike RoutineInstance) carries no end time — resolveEventSpan in
// calendarItems.ts only tracks which *days* an event spans, not its
// duration within a day. A fixed placeholder height is a deliberate
// simplification: this timeline's job is showing roughly where the day is
// already busy so a routine can be dropped around it, not pixel-accurate
// existing-event duration.
const DEFAULT_CALENDAR_EVENT_MINUTES = 30

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function minutesSinceGridStart(iso: string): number {
  const [h, m] = new Date(iso)
    .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' })
    .split(':')
    .map(Number)
  return (h - START_HOUR) * 60 + m
}

const SLOTS: { id: string; top: number }[] = []
for (let h = START_HOUR; h < END_HOUR; h++) {
  for (let q = 0; q < 60; q += SLOT_MINUTES) {
    SLOTS.push({ id: `slot:${pad(h)}:${pad(q)}`, top: ((h - START_HOUR) * 60 + q) * PX_PER_MIN })
  }
}

type TimedItem = Extract<DayItem, { kind: 'calendar' }> | Extract<DayItem, { kind: 'routine' }>

function isTimed(item: DayItem): item is TimedItem {
  return (item.kind === 'calendar' && !item.allDay && item.start !== null) || item.kind === 'routine'
}

// Left-side single-day view for the Routines tab: an untimed strip (all-day
// events, tasks, activity sessions — none of which carry a time-of-day in
// the current data model) above a scrollable hour grid with discrete
// 15-minute droppable slots, so a routine card dragged from RoutineSidebar
// snaps to a specific time. Dumb/prop-fed — takes the same itemsByDate
// slice CalendarPageView already computes, no fetch of its own.
export default function DayTimeline({
  items,
  onSelectRoutineInstance,
  onSelectTask,
}: {
  dateKey: string
  items: DayItem[]
  onSelectRoutineInstance: (instance: RoutineInstance) => void
  onSelectTask: (task: Task) => void
}) {
  const untimed = items.filter((item) => !isTimed(item))
  const timed = items.filter(isTimed)

  return (
    <div className="flex flex-col gap-2">
      {untimed.length > 0 && (
        <ul className="flex flex-col gap-1 border-b border-outline-variant/60 pb-2 text-sm">
          {untimed.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex items-center gap-2 text-on-surface">
              {item.kind === 'task' ? (
                <button
                  type="button"
                  onClick={() => onSelectTask(item.task)}
                  className="truncate text-left hover:underline"
                >
                  {item.title}
                </button>
              ) : (
                <span className="truncate">{item.title}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="relative overflow-y-auto rounded-lg border border-outline-variant/60" style={{ height: 420 }}>
        <div className="relative" style={{ height: GRID_HEIGHT }}>
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i).map((h) => (
            <div
              key={`hour-${h}`}
              className="pointer-events-none absolute left-0 right-0 border-t border-outline-variant/40 px-1.5 text-[10px] text-on-surface-variant"
              style={{ top: (h - START_HOUR) * 60 * PX_PER_MIN }}
            >
              {pad(h)}:00
            </div>
          ))}

          {SLOTS.map((slot) => (
            <TimeSlot key={slot.id} id={slot.id} top={slot.top} height={SLOT_MINUTES * PX_PER_MIN} />
          ))}

          {timed.map((item) => {
            const start = item.kind === 'calendar' ? item.start! : item.start
            const durationMinutes = item.kind === 'routine' ? item.durationMinutes : DEFAULT_CALENDAR_EVENT_MINUTES
            const colour = item.kind === 'routine' ? item.colour : null
            const top = Math.max(0, minutesSinceGridStart(start) * PX_PER_MIN)
            const height = Math.max(20, durationMinutes * PX_PER_MIN)

            return (
              <button
                type="button"
                key={`${item.kind}-${item.id}`}
                onClick={() => item.kind === 'routine' && onSelectRoutineInstance(item.instance)}
                style={{
                  top,
                  height,
                  left: GUTTER_PX,
                  right: 4,
                  backgroundColor: colour ? `${colour}33` : 'rgba(218,229,218,0.12)',
                  borderColor: colour ?? 'rgba(218,229,218,0.3)',
                }}
                className="absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] text-on-surface"
              >
                <span className="font-semibold">{formatTime(start)}</span> {item.title}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TimeSlot({ id, top, height }: { id: string; top: number; height: number }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ top, height, left: GUTTER_PX, right: 0 }}
      className={`absolute transition-colors ${isOver ? 'bg-habit-purple/20' : ''}`}
    />
  )
}
