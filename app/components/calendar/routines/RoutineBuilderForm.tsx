'use client'

import { useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Routine, RoutineItem } from '@/lib/types'
import Modal from '../../Modal'
import RoutineItemEditor, { type RoutineItemEditorHandle } from './RoutineItemEditor'

// Mirrors the module accent palette (purple=Habits, mint=Health,
// blue=Money, orange=Education, pink=Research) plus two extras, matching
// HabitFormModal's 7-swatch picker convention. Purple first since it's the
// default and ties routines visually to the Habits family.
export const ROUTINE_COLOUR_OPTIONS = [
  '#c084fc', // purple
  '#00ff9d', // mint
  '#3987e5', // blue
  '#d95926', // orange
  '#d55181', // pink
  '#199e70', // aqua
  '#e66767', // red
]

// Creating vs editing an existing routine: routine === null means nothing
// has been persisted yet — the routines row is created lazily by
// RoutineItemEditor's ensureRoutineId, on the first step's green checkmark,
// not on name entry alone. Until then, name/colour are just local state.
export default function RoutineBuilderForm({
  routine,
  items,
  onRoutineCreated,
  onRoutineUpdated,
  onItemsChange,
  onDone,
}: {
  routine: Routine | null
  items: RoutineItem[]
  onRoutineCreated: (routine: Routine) => void
  onRoutineUpdated: (routine: Routine) => void
  onItemsChange: (items: RoutineItem[]) => void
  onDone: () => void
}) {
  const [name, setName] = useState(routine?.name ?? '')
  const [colour, setColour] = useState(routine?.colour ?? ROUTINE_COLOUR_OPTIONS[0])
  const [error, setError] = useState<string | null>(null)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  const itemEditorRef = useRef<RoutineItemEditorHandle>(null)

  // Both exits (the back arrow and the Done button) go through this guard —
  // leaving with text still sitting in the add-step form, or an item still
  // mid-inline-edit, would silently discard it otherwise.
  const requestClose = () => {
    if (itemEditorRef.current?.hasUnsavedInput()) {
      setShowUnsavedWarning(true)
      return
    }
    onDone()
  }

  const ensureRoutineId = async (): Promise<string> => {
    if (routine) return routine.id
    const { data, error: insertError } = await supabase
      .from('routines')
      .insert({ name: name.trim() || 'New Routine', colour })
      .select('*')
      .single()
    if (insertError || !data) {
      throw new Error(insertError?.message ?? 'Failed to create routine')
    }
    onRoutineCreated(data as Routine)
    return data.id
  }

  const handleNameBlur = async () => {
    const trimmed = name.trim()
    if (!trimmed || !routine || trimmed === routine.name) return
    const { data, error: updateError } = await supabase
      .from('routines')
      .update({ name: trimmed })
      .eq('id', routine.id)
      .select('*')
      .single()
    if (updateError) {
      setError(`Couldn't save name: ${updateError.message}`)
      return
    }
    if (data) onRoutineUpdated(data as Routine)
  }

  const handleColourClick = async (c: string) => {
    setColour(c)
    if (!routine) return
    const { data, error: updateError } = await supabase
      .from('routines')
      .update({ colour: c })
      .eq('id', routine.id)
      .select('*')
      .single()
    if (updateError) {
      setError(`Couldn't save colour: ${updateError.message}`)
      return
    }
    if (data) onRoutineUpdated(data as Routine)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={requestClose}
          aria-label="Back to routines"
          className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="font-display text-sm font-semibold text-on-surface">
          {routine ? 'Edit routine' : 'New routine'}
        </h3>
      </div>

      {error && (
        <div className="rounded-md border border-error/30 bg-error/10 px-2 py-1.5 text-xs text-error">{error}</div>
      )}

      <div className="flex gap-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          placeholder="e.g. Morning Routine"
          className="flex-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-habit-purple"
        />
        <div className="flex shrink-0 gap-1.5">
          {ROUTINE_COLOUR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleColourClick(c)}
              aria-label={`Colour ${c}`}
              className="h-7 w-7 rounded-full"
              style={{
                backgroundColor: c,
                outline: colour === c ? '2px solid #dae5da' : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </div>

      {!routine && !name.trim() && (
        <p className="text-xs text-on-surface-variant">Name the routine, then add its first step below.</p>
      )}

      <RoutineItemEditor
        ref={itemEditorRef}
        routineId={routine?.id ?? null}
        items={items}
        onItemsChange={onItemsChange}
        ensureRoutineId={ensureRoutineId}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={requestClose}
          className="rounded-lg bg-habit-purple px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110"
        >
          Done
        </button>
      </div>

      {showUnsavedWarning && (
        <Modal onClose={() => setShowUnsavedWarning(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-on-surface-variant">
              You&apos;ve got unfinished text in a step — finish it or clear it, or discard it now.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedWarning(false)
                  onDone()
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-error"
              >
                Discard changes
              </button>
              <button
                type="button"
                onClick={() => setShowUnsavedWarning(false)}
                className="rounded-lg bg-habit-purple px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110"
              >
                Keep editing
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
