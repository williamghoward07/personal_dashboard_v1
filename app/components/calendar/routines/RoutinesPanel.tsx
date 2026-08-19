'use client'

import { useState } from 'react'
import {
  DndContext,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { RoutineInstance, Task } from '@/lib/types'
import { londonDateTimeToUTCISO } from '@/lib/google/london-day'
import type { DayItem } from '../calendarItems'
import DayTimeline from './DayTimeline'
import RoutineSidebar from './RoutineSidebar'

// Split-screen shell for the Calendar page's Routines tab: DayTimeline on
// the left, RoutineSidebar (saved templates + builder) on the right. Owns
// the one DndContext the two panels share — dnd-kit only resolves a drop
// between draggables/droppables registered under the same provider. Only
// one drag type ever happens here (a whole routine card onto a time slot),
// so onDragEnd needs no type-discrimination, unlike RoutineItemEditor's own
// separate DndContext for in-builder step reordering.
export default function RoutinesPanel({
  dateKey,
  items,
  onScheduled,
  onSelectRoutineInstance,
  onSelectTask,
}: {
  dateKey: string
  items: DayItem[]
  onScheduled: () => void
  onSelectRoutineInstance: (instance: RoutineInstance) => void
  onSelectTask: (task: Task) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [scheduling, setScheduling] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const routineId = active.data.current?.routineId as string | undefined
    const slotId = String(over.id)
    if (!routineId || !slotId.startsWith('slot:')) return

    const time = slotId.slice('slot:'.length)
    const startAt = londonDateTimeToUTCISO(dateKey, time)

    setScheduling(true)
    setError(null)
    try {
      const res = await fetch('/api/routines/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routine_id: routineId, start_at: startAt }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}) as { message?: string })
        setError(json.message ?? "Couldn't schedule the routine.")
        return
      }
      onScheduled()
    } finally {
      setScheduling(false)
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-3">
        {error && (
          <div className="rounded-md border border-error/30 bg-error/10 px-2 py-1.5 text-xs text-error">{error}</div>
        )}
        {scheduling && <p className="text-xs text-on-surface-variant">Scheduling...</p>}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DayTimeline
            dateKey={dateKey}
            items={items}
            onSelectRoutineInstance={onSelectRoutineInstance}
            onSelectTask={onSelectTask}
          />
          <RoutineSidebar />
        </div>
      </div>
    </DndContext>
  )
}
