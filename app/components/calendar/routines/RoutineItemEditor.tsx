'use client'

import { forwardRef, useImperativeHandle, useState } from 'react'
import { Check, GripVertical, Pencil, Trash2, X } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { supabase } from '@/lib/supabase'
import type { RoutineItem } from '@/lib/types'

const DURATION_PRESETS = [2, 5, 10, 15, 20, 30, 45, 60]
const MIN_BLOCK_PX = 48
const PX_PER_MINUTE = 2.5
const MAX_BLOCK_PX = 200

function blockHeight(minutes: number) {
  return Math.min(MAX_BLOCK_PX, MIN_BLOCK_PX + minutes * PX_PER_MINUTE)
}

interface NewItemDraft {
  name: string
  description: string
  duration_minutes: number
}

const EMPTY_DRAFT: NewItemDraft = { name: '', description: '', duration_minutes: 5 }

const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-habit-purple'

// Imperative escape hatch for RoutineBuilderForm's Done button: it needs to
// know, at the moment Done is clicked, whether the add-step draft or an
// in-progress item edit holds text that hasn't been saved yet — not a
// continuously-synced "dirty" prop, since that would need an effect just to
// notify the parent of state this component already owns.
export interface RoutineItemEditorHandle {
  hasUnsavedInput: () => boolean
}

// Shared between the routine builder (RoutineBuilderForm) and the scheduled-
// occurrence viewer (RoutineInstanceModal) so the add/reorder/edit UI for a
// routine's steps only exists in one place. routineId is null until the
// first step is added — ensureRoutineId lazily creates the routines row
// (name + colour, already entered by the caller) on that first checkmark,
// so there's no separate "save routine" step and no draft state to lose.
const RoutineItemEditor = forwardRef<
  RoutineItemEditorHandle,
  {
    routineId: string | null
    items: RoutineItem[]
    // Carries the routine id alongside the items — a caller whose own
    // "current routine" state is closed over from an earlier render (e.g.
    // RoutineSidebar, before the routine created by ensureRoutineId() below
    // has propagated back into that state) would otherwise silently drop
    // the very first update for a brand-new routine.
    onItemsChange: (routineId: string, items: RoutineItem[]) => void
    ensureRoutineId: () => Promise<string>
  }
>(function RoutineItemEditor({ routineId, items, onItemsChange, ensureRoutineId }, ref) {
  const [draft, setDraft] = useState<NewItemDraft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useImperativeHandle(ref, () => ({
    hasUnsavedInput: () => editingId !== null || draft.name.trim() !== '' || draft.description.trim() !== '',
  }))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleAdd = async () => {
    const name = draft.name.trim()
    if (!name || draft.duration_minutes <= 0 || saving) return
    setSaving(true)
    try {
      const id = routineId ?? (await ensureRoutineId())
      const { data, error: insertError } = await supabase
        .from('routine_items')
        .insert({
          routine_id: id,
          name,
          description: draft.description.trim(),
          duration_minutes: draft.duration_minutes,
          sort_order: items.length,
        })
        .select('*')
        .single()

      if (insertError || !data) {
        setError(`Couldn't add step: ${insertError?.message ?? 'unknown error'}`)
        return
      }
      onItemsChange(id, [...items, data as RoutineItem])
      setDraft(EMPTY_DRAFT)
      setError(null)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item: RoutineItem) => {
    const { error: deleteError } = await supabase.from('routine_items').delete().eq('id', item.id)
    if (deleteError) {
      setError(`Couldn't delete step: ${deleteError.message}`)
      return
    }
    onItemsChange(item.routine_id, items.filter((i) => i.id !== item.id))
  }

  const handleUpdate = async (item: RoutineItem, values: { name: string; description: string; duration_minutes: number }) => {
    const { data, error: updateError } = await supabase
      .from('routine_items')
      .update(values)
      .eq('id', item.id)
      .select('*')
      .single()
    if (updateError || !data) {
      setError(`Couldn't save step: ${updateError?.message ?? 'unknown error'}`)
      return
    }
    onItemsChange(item.routine_id, items.map((i) => (i.id === item.id ? (data as RoutineItem) : i)))
    setEditingId(null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(items, oldIndex, newIndex)
    onItemsChange(reordered[0].routine_id, reordered)

    const results = await Promise.all(
      reordered.map((item, i) => supabase.from('routine_items').update({ sort_order: i }).eq('id', item.id))
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) setError(`Couldn't save new order: ${failed.error.message}`)
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-md border border-error/30 bg-error/10 px-2 py-1.5 text-xs text-error">{error}</div>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-outline-variant/60 p-3">
        <div className="flex gap-2">
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Step name"
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.name.trim() || saving}
            aria-label="Add step"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container transition-opacity hover:brightness-110 disabled:opacity-40"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>
        <input
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="Short description (optional)"
          className={`${inputClass} text-xs`}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {DURATION_PRESETS.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, duration_minutes: mins }))}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                draft.duration_minutes === mins
                  ? 'bg-habit-purple text-surface-container-lowest'
                  : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {mins}m
            </button>
          ))}
          <input
            type="number"
            min={1}
            value={draft.duration_minutes}
            onChange={(e) => setDraft((d) => ({ ...d, duration_minutes: Math.max(1, Number(e.target.value) || 1) }))}
            aria-label="Custom duration in minutes"
            className={`${inputClass} w-16 text-xs`}
          />
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-on-surface-variant">No steps yet — add one above.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-1.5">
              {items.map((item) => (
                <RoutineStepBlock
                  key={item.id}
                  item={item}
                  isEditing={editingId === item.id}
                  onEditStart={() => setEditingId(item.id)}
                  onEditCancel={() => setEditingId(null)}
                  onSave={(values) => handleUpdate(item, values)}
                  onDelete={() => handleDelete(item)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
})

export default RoutineItemEditor

function RoutineStepBlock({
  item,
  isEditing,
  onEditStart,
  onEditCancel,
  onSave,
  onDelete,
}: {
  item: RoutineItem
  isEditing: boolean
  onEditStart: () => void
  onEditCancel: () => void
  onSave: (values: { name: string; description: string; duration_minutes: number }) => void
  onDelete: () => void
}) {
  // Drag reordering is scoped to a dedicated handle, not the whole block —
  // same reasoning as HabitCard.tsx: the block already has its own
  // clickable edit/delete buttons that would otherwise fight the pointer
  // sensor for the same pointerdown events.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const [values, setValues] = useState({
    name: item.name,
    description: item.description,
    duration_minutes: item.duration_minutes,
  })

  const style = {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
      : undefined,
    transition: transition ?? undefined,
  }

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex flex-col gap-2 rounded-lg border border-habit-purple/40 bg-surface-container-lowest p-3"
      >
        <input
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          className={inputClass}
        />
        <input
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          placeholder="Short description (optional)"
          className={`${inputClass} text-xs`}
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={values.duration_minutes}
            onChange={(e) =>
              setValues((v) => ({ ...v, duration_minutes: Math.max(1, Number(e.target.value) || 1) }))
            }
            className={`${inputClass} w-20 text-xs`}
          />
          <span className="text-xs text-on-surface-variant">minutes</span>
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={onEditCancel}
              aria-label="Cancel"
              className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onSave({ ...values, name: values.name.trim() })}
              disabled={!values.name.trim()}
              aria-label="Save step"
              className="rounded p-1.5 text-primary-container hover:bg-surface-container-high disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, minHeight: blockHeight(item.duration_minutes) }}
      className={`flex items-start gap-2 rounded-lg border border-outline-variant bg-linear-to-br from-surface-container-low to-surface-container-lowest p-3 transition-all hover:border-habit-purple/40 ${
        isDragging ? 'z-10 opacity-60' : ''
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${item.name}`}
        className="shrink-0 touch-none cursor-grab rounded p-1 text-on-surface-variant/40 hover:bg-surface-container-high hover:text-on-surface-variant active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-sm font-semibold text-on-surface">{item.name}</h4>
          <span className="shrink-0 rounded-full bg-surface-container-highest px-1.5 py-0.5 text-[10px] text-on-surface-variant">
            {item.duration_minutes}m
          </span>
        </div>
        {item.description && <p className="text-xs text-on-surface-variant">{item.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => {
            setValues({ name: item.name, description: item.description, duration_minutes: item.duration_minutes })
            onEditStart()
          }}
          aria-label={`Edit ${item.name}`}
          className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${item.name}`}
          className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
