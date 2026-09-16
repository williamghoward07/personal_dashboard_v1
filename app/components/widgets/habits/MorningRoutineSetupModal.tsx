'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import Modal from '../../Modal'
import {
  DEFAULT_ROUTINE_TARGET,
  SUGGESTED_BONUS_STEPS,
  SUGGESTED_CORE_STEPS,
} from '@/lib/habits/steps'
import { createMorningRoutine } from '@/lib/habits/use-morning-routines'

const inputClass =
  'min-w-0 flex-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-habit-purple'
const MAX_CORE = 3

function StepList({
  label,
  hint,
  steps,
  max,
  placeholder,
  onChange,
}: {
  label: string
  hint: string
  steps: string[]
  max?: number
  placeholder: string
  onChange: (steps: string[]) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col text-xs text-on-surface-variant">
        <span className="font-semibold text-on-surface">{label}</span>
        <span className="text-[11px]">{hint}</span>
      </div>
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            value={step}
            onChange={(e) => onChange(steps.map((s, j) => (j === i ? e.target.value : s)))}
            placeholder={placeholder}
            aria-label={`${label} ${i + 1}`}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => onChange(steps.filter((_, j) => j !== i))}
            aria-label={`Remove ${step || 'step'}`}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {(max === undefined || steps.length < max) && (
        <button
          type="button"
          onClick={() => onChange([...steps, ''])}
          className="flex w-fit items-center gap-1 rounded-md px-1.5 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-habit-purple"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      )}
    </div>
  )
}

// First-run setup: a small, realistic routine — one to three core steps
// that count, optional bonus steps, and a weekly target below seven so a
// busy morning doesn't break anything.
export default function MorningRoutineSetupModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  onCreated?: () => void
}) {
  const [name, setName] = useState('Morning routine')
  const [target, setTarget] = useState(DEFAULT_ROUTINE_TARGET)
  const [core, setCore] = useState<string[]>(SUGGESTED_CORE_STEPS)
  const [bonus, setBonus] = useState<string[]>(SUGGESTED_BONUS_STEPS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const coreCount = core.filter((s) => s.trim()).length

  const save = async () => {
    setSaving(true)
    const failure = await createMorningRoutine({ name, weeklyTarget: target, coreSteps: core, bonusSteps: bonus })
    setSaving(false)
    if (failure) {
      setError(failure)
      return
    }
    setError(null)
    onCreated?.()
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (coreCount > 0 && !saving) void save()
        }}
        className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto"
      >
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-sm font-semibold text-on-surface">Set up a morning routine</h2>
          <p className="text-xs text-on-surface-variant">
            Keep it small enough to do on your worst morning. Ticking every core step marks the day done; bonus steps
            are extra credit. Everything here is editable later from Habits.
          </p>
        </div>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-xs text-on-surface-variant">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex w-28 shrink-0 flex-col gap-1 text-xs text-on-surface-variant">
            Days / week
            <input
              type="number"
              min={1}
              max={7}
              value={target}
              onChange={(e) => setTarget(Math.min(7, Math.max(1, Number(e.target.value) || 1)))}
              className={inputClass}
            />
          </label>
        </div>

        <StepList
          label="Core steps"
          hint={`One to ${MAX_CORE} tiny things. These are what count.`}
          steps={core}
          max={MAX_CORE}
          placeholder="e.g. Drink a glass of water"
          onChange={setCore}
        />
        <StepList
          label="Bonus steps"
          hint="Nice when there's time. Never required."
          steps={bonus}
          placeholder="e.g. Stretch for 5 minutes"
          onChange={setBonus}
        />

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={coreCount === 0 || saving}
            className="rounded-lg bg-habit-purple px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110 disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create routine'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
