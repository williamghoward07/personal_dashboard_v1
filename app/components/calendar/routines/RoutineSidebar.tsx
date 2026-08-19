'use client'

import { useEffect, useMemo, useState } from 'react'
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { supabase } from '@/lib/supabase'
import type { Routine, RoutineItem } from '@/lib/types'
import ConfirmDialog from '../../ConfirmDialog'
import RoutineBuilderForm from './RoutineBuilderForm'

type Mode = { kind: 'list' } | { kind: 'builder'; routine: Routine | null }

// Owns its own fetch of every routine template + its steps, independent of
// the calendar's selectedDateKey (templates aren't date-scoped) — same
// self-contained-fetch shape as HabitBoard. Renders either the saved-
// template list (default) or RoutineBuilderForm when adding/editing one.
export default function RoutineSidebar() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [itemsByRoutineId, setItemsByRoutineId] = useState<Map<string, RoutineItem[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [deletingRoutine, setDeletingRoutine] = useState<Routine | null>(null)

  const refresh = () => {
    setLoading(true)
    Promise.all([
      supabase.from('routines').select('*').order('created_at', { ascending: true }),
      supabase.from('routine_items').select('*').order('sort_order', { ascending: true }),
    ]).then(([routinesRes, itemsRes]) => {
      if (routinesRes.error || itemsRes.error) {
        setError(`Couldn't load routines: ${routinesRes.error?.message ?? itemsRes.error?.message}`)
      } else {
        setError(null)
      }
      setRoutines((routinesRes.data ?? []) as Routine[])
      const grouped = new Map<string, RoutineItem[]>()
      for (const item of (itemsRes.data ?? []) as RoutineItem[]) {
        const list = grouped.get(item.routine_id)
        if (list) list.push(item)
        else grouped.set(item.routine_id, [item])
      }
      setItemsByRoutineId(grouped)
      setLoading(false)
    })
  }

  useEffect(refresh, [])

  const activeItems = useMemo(() => {
    if (mode.kind !== 'builder' || !mode.routine) return []
    return itemsByRoutineId.get(mode.routine.id) ?? []
  }, [mode, itemsByRoutineId])

  if (mode.kind === 'builder') {
    return (
      <RoutineBuilderForm
        routine={mode.routine}
        items={activeItems}
        onRoutineCreated={(routine) => {
          setRoutines((rs) => [...rs, routine])
          setMode({ kind: 'builder', routine })
        }}
        onRoutineUpdated={(routine) => {
          setRoutines((rs) => rs.map((r) => (r.id === routine.id ? routine : r)))
          setMode({ kind: 'builder', routine })
        }}
        onItemsChange={(items) => {
          if (!mode.routine) return
          setItemsByRoutineId((m) => new Map(m).set(mode.routine!.id, items))
        }}
        onDone={() => {
          setMode({ kind: 'list' })
          refresh()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-on-surface">Routines</h3>
        <button
          type="button"
          onClick={() => setMode({ kind: 'builder', routine: null })}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-habit-purple hover:bg-surface-container-high"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Routine
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-error/30 bg-error/10 px-2 py-1.5 text-xs text-error">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading...</p>
      ) : routines.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          No routines yet — add one, then drag it onto the day timeline to schedule it.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {routines.map((routine) => {
            const items = itemsByRoutineId.get(routine.id) ?? []
            return (
              <RoutineTemplateCard
                key={routine.id}
                routine={routine}
                items={items}
                onEdit={() => setMode({ kind: 'builder', routine })}
                onDelete={() => setDeletingRoutine(routine)}
              />
            )
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={deletingRoutine !== null}
        message={`Delete "${deletingRoutine?.name}"? Steps are removed too. Already-scheduled occurrences on your calendar are kept.`}
        onCancel={() => setDeletingRoutine(null)}
        onConfirm={async () => {
          if (!deletingRoutine) return
          const { error: deleteError } = await supabase.from('routines').delete().eq('id', deletingRoutine.id)
          setDeletingRoutine(null)
          if (deleteError) {
            setError(`Couldn't delete routine: ${deleteError.message}`)
            return
          }
          refresh()
        }}
      />
    </div>
  )
}

function RoutineTemplateCard({
  routine,
  items,
  onEdit,
  onDelete,
}: {
  routine: Routine
  items: RoutineItem[]
  onEdit: () => void
  onDelete: () => void
}) {
  const totalMinutes = items.reduce((sum, item) => sum + item.duration_minutes, 0)
  const canDrag = items.length > 0

  // Draggable onto DayTimeline's slots — RoutinesPanel's shared DndContext
  // reads this id back in onDragEnd via the "routine:" prefix, and the
  // routine id itself via `data.routineId` rather than string-parsing.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `routine:${routine.id}`,
    data: { routineId: routine.id },
    disabled: !canDrag,
  })

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 rounded-lg border border-outline-variant bg-linear-to-br from-surface-container-low to-surface-container-lowest p-3 transition-all hover:border-habit-purple/40 ${
        isDragging ? 'z-10 opacity-60' : ''
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={!canDrag}
        aria-label={canDrag ? `Drag ${routine.name} onto the calendar` : `${routine.name} has no steps yet`}
        title={canDrag ? 'Drag onto the day timeline to schedule' : 'Add a step before scheduling'}
        className="shrink-0 touch-none cursor-grab rounded p-1 text-on-surface-variant/40 hover:bg-surface-container-high hover:text-on-surface-variant active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: routine.colour }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <h4 className="truncate text-sm font-semibold text-on-surface">{routine.name}</h4>
        <p className="text-xs text-on-surface-variant">
          {items.length} {items.length === 1 ? 'step' : 'steps'} · {totalMinutes}m
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${routine.name}`}
          className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${routine.name}`}
          className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
