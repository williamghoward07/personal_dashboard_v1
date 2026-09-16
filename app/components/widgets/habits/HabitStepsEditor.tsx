'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useHabitSteps } from '@/lib/habits/use-habit-steps'
import { notifyHabitsChanged } from '@/lib/habits/events'

const inputClass =
  'min-w-0 flex-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-habit-purple'

function CoreToggle({ isCore, onToggle }: { isCore: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isCore ? 'Core: needed for the day to count' : 'Bonus: extra, never required'}
      className={`w-14 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isCore ? 'bg-habit-purple text-surface-container-lowest' : 'bg-surface-container-highest text-on-surface-variant'
      }`}
    >
      {isCore ? 'Core' : 'Bonus'}
    </button>
  )
}

// Checklist steps for a habit (e.g. a morning routine). Saves as you go.
// Ticking every core step on a day marks the habit done for that day.
export default function HabitStepsEditor({ habitId }: { habitId: string }) {
  const { steps, error, addStep, updateStep, moveStep, removeStep } = useHabitSteps(habitId)
  const [newTitle, setNewTitle] = useState('')
  const [newIsCore, setNewIsCore] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const commitTitle = (id: string, original: string) => {
    const value = drafts[id]
    if (value === undefined) return
    setDrafts((d) => {
      const next = { ...d }
      delete next[id]
      return next
    })
    if (value.trim() && value.trim() !== original) void updateStep(id, { title: value.trim() })
  }

  const changed = () => notifyHabitsChanged()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5 text-xs text-on-surface-variant">
        <span>Steps</span>
        <span className="text-[11px] text-on-surface-variant/70">
          Optional. Ticking every <b className="font-semibold">core</b> step marks this habit done for the day;{' '}
          <b className="font-semibold">bonus</b> steps are extra. Keep core to one to three small things.
        </span>
      </div>

      {steps.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {steps.map((step, i) => (
            <li key={step.id} className="flex items-center gap-1.5">
              <CoreToggle
                isCore={step.is_core}
                onToggle={() => {
                  void updateStep(step.id, { is_core: !step.is_core })
                  changed()
                }}
              />
              <input
                value={drafts[step.id] ?? step.title}
                onChange={(e) => setDrafts((d) => ({ ...d, [step.id]: e.target.value }))}
                onBlur={() => commitTitle(step.id, step.title)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitTitle(step.id, step.title)
                  }
                }}
                aria-label={`Step ${i + 1}`}
                className={inputClass}
              />
              <button
                type="button"
                disabled={i === 0}
                onClick={() => void moveStep(step.id, -1)}
                aria-label={`Move ${step.title} up`}
                className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={i === steps.length - 1}
                onClick={() => void moveStep(step.id, 1)}
                aria-label={`Move ${step.title} down`}
                className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  void removeStep(step.id)
                  changed()
                }}
                aria-label={`Delete ${step.title}`}
                className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Not a <form>: this sits inside the habit form, and nested forms
          aren't allowed. Enter adds the step instead. */}
      <div className="flex items-center gap-1.5">
        <CoreToggle isCore={newIsCore} onToggle={() => setNewIsCore((v) => !v)} />
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void addStep(newTitle, newIsCore)
              setNewTitle('')
            }
          }}
          placeholder="Add a step, e.g. Drink a glass of water"
          aria-label="New step"
          className={inputClass}
        />
        <button
          type="button"
          disabled={!newTitle.trim()}
          onClick={() => {
            void addStep(newTitle, newIsCore)
            setNewTitle('')
          }}
          aria-label="Add step"
          className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-habit-purple disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {error && <p className="text-[11px] text-error">{error}</p>}
    </div>
  )
}
