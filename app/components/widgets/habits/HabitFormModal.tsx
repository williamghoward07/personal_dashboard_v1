'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { DailyGoalHabit, DailyGoalHabitFrequency } from '@/lib/types'

export interface HabitFormValues {
  name: string
  icon: string
  description: string
  colour: string
  frequency_type: DailyGoalHabitFrequency
  days_of_week: number[] | null
  weekly_target: number | null
  is_quantifiable: boolean
  target_value: number | null
  unit: string | null
}

const COLOUR_OPTIONS = [
  '#3987e5', // blue
  '#d95926', // orange
  '#199e70', // aqua
  '#c98500', // yellow
  '#d55181', // magenta
  '#9085e9', // violet
  '#e66767', // red
]

const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

const EMPTY: HabitFormValues = {
  name: '',
  icon: '⭐',
  description: '',
  colour: COLOUR_OPTIONS[0],
  frequency_type: 'daily',
  days_of_week: null,
  weekly_target: null,
  is_quantifiable: false,
  target_value: null,
  unit: null,
}

export default function HabitFormModal({
  isOpen,
  heading,
  initialValues,
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  initialValues?: Partial<DailyGoalHabit> | null
  onSave: (values: HabitFormValues) => void
  onClose: () => void
}) {
  const [values, setValues] = useState<HabitFormValues>(EMPTY)

  useEffect(() => {
    if (isOpen) {
      setValues({
        name: initialValues?.name ?? '',
        icon: initialValues?.icon ?? '⭐',
        description: initialValues?.description ?? '',
        colour: initialValues?.colour ?? COLOUR_OPTIONS[0],
        frequency_type: initialValues?.frequency_type ?? 'daily',
        days_of_week: initialValues?.days_of_week ?? null,
        weekly_target: initialValues?.weekly_target ?? null,
        is_quantifiable: initialValues?.is_quantifiable ?? false,
        target_value: initialValues?.target_value ?? null,
        unit: initialValues?.unit ?? null,
      })
    }
  }, [isOpen, initialValues])

  if (!isOpen) return null

  const inputClass =
    'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-habit-purple'
  const labelClass = 'flex flex-col gap-1 text-xs text-on-surface-variant'

  const canSubmit =
    values.name.trim().length > 0 &&
    (values.frequency_type !== 'specific_days' || (values.days_of_week?.length ?? 0) > 0)

  const setFrequencyType = (frequency_type: DailyGoalHabitFrequency) => {
    setValues((v) => ({
      ...v,
      frequency_type,
      days_of_week: frequency_type === 'specific_days' ? (v.days_of_week ?? []) : null,
      weekly_target: frequency_type === 'times_per_week' ? (v.weekly_target ?? 3) : null,
    }))
  }

  const toggleDay = (day: number) => {
    setValues((v) => {
      const current = v.days_of_week ?? []
      const next = current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a - b)
      return { ...v, days_of_week: next }
    })
  }

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return
          onSave({
            ...values,
            name: values.name.trim(),
            icon: values.icon.trim() || '⭐',
            unit: values.is_quantifiable ? (values.unit?.trim() || null) : null,
            target_value: values.is_quantifiable ? values.target_value : null,
          })
        }}
        className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto"
      >
        <h2 className="font-display text-sm font-semibold text-on-surface">{heading}</h2>

        <div className="flex gap-3">
          <label className={`${labelClass} w-16 shrink-0`}>
            Icon
            <input
              autoFocus
              value={values.icon}
              onChange={(e) => setValues((v) => ({ ...v, icon: e.target.value }))}
              placeholder="⭐"
              maxLength={4}
              className={`${inputClass} text-center text-lg`}
            />
          </label>
          <label className={`${labelClass} flex-1`}>
            Name
            <input
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              placeholder="e.g. Reading"
              className={inputClass}
            />
          </label>
        </div>

        <label className={labelClass}>
          Description
          <input
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            placeholder="e.g. Read for at least 15 minutes"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Frequency
          <select
            value={values.frequency_type}
            onChange={(e) => setFrequencyType(e.target.value as DailyGoalHabitFrequency)}
            className={inputClass}
          >
            <option value="daily">Daily</option>
            <option value="specific_days">Specific days</option>
            <option value="times_per_week">Times per week</option>
          </select>
        </label>

        {values.frequency_type === 'specific_days' && (
          <div className={labelClass}>
            Which days
            <div className="flex flex-wrap gap-1.5 pt-1">
              {DAY_OPTIONS.map((day) => {
                const active = (values.days_of_week ?? []).includes(day.value)
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    aria-pressed={active}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      active
                        ? 'bg-habit-purple text-surface-container-lowest'
                        : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
            {(values.days_of_week?.length ?? 0) === 0 && (
              <span className="text-[11px] text-error">Pick at least one day</span>
            )}
          </div>
        )}

        {values.frequency_type === 'times_per_week' && (
          <label className={`${labelClass} w-28 shrink-0`}>
            Times / week
            <input
              type="number"
              min={1}
              max={7}
              value={values.weekly_target ?? 3}
              onChange={(e) =>
                setValues((v) => ({ ...v, weekly_target: Number(e.target.value) || 1 }))
              }
              className={inputClass}
            />
          </label>
        )}

        <label className="flex items-center gap-2 text-xs text-on-surface-variant">
          <input
            type="checkbox"
            checked={values.is_quantifiable}
            onChange={(e) => setValues((v) => ({ ...v, is_quantifiable: e.target.checked }))}
            className="accent-habit-purple"
          />
          This habit is quantifiable (e.g. pages read, km run)
        </label>

        {values.is_quantifiable && (
          <div className="flex gap-3">
            <label className={`${labelClass} w-24 shrink-0`}>
              Target
              <input
                type="number"
                min={0}
                value={values.target_value ?? ''}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    target_value: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
                className={inputClass}
              />
            </label>
            <label className={`${labelClass} flex-1`}>
              Unit
              <input
                value={values.unit ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))}
                placeholder="e.g. pages, km, glasses"
                className={inputClass}
              />
            </label>
          </div>
        )}

        <div className={labelClass}>
          Colour
          <div className="flex gap-2 pt-1">
            {COLOUR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValues((v) => ({ ...v, colour: c }))}
                aria-label={`Colour ${c}`}
                className="h-7 w-7 rounded-full"
                style={{
                  backgroundColor: c,
                  outline: values.colour === c ? '2px solid #dae5da' : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </div>

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
            disabled={!canSubmit}
            className="rounded-lg bg-habit-purple px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
