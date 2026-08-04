'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { Habit, HabitFrequencyType } from '@/lib/types'

export interface HabitFormValues {
  name: string
  icon: string
  description: string
  color: string
  frequency_type: HabitFrequencyType
  frequency_count: number
  is_quantifiable: boolean
  target_value: number | null
  unit: string | null
}

const COLOR_OPTIONS = [
  '#3987e5', // blue
  '#d95926', // orange
  '#199e70', // aqua
  '#c98500', // yellow
  '#d55181', // magenta
  '#9085e9', // violet
  '#e66767', // red
]

const EMPTY: HabitFormValues = {
  name: '',
  icon: '⭐',
  description: '',
  color: COLOR_OPTIONS[0],
  frequency_type: 'daily',
  frequency_count: 1,
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
  initialValues?: Partial<Habit> | null
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
        color: initialValues?.color ?? COLOR_OPTIONS[0],
        frequency_type: initialValues?.frequency_type ?? 'daily',
        frequency_count: initialValues?.frequency_count ?? 1,
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

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!values.name.trim()) return
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

        <div className="flex gap-3">
          <label className={`${labelClass} flex-1`}>
            Frequency
            <select
              value={values.frequency_type}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  frequency_type: e.target.value as HabitFrequencyType,
                  frequency_count: e.target.value === 'daily' ? 1 : v.frequency_count,
                }))
              }
              className={inputClass}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          {values.frequency_type === 'weekly' && (
            <label className={`${labelClass} w-28 shrink-0`}>
              Times / week
              <input
                type="number"
                min={1}
                max={7}
                value={values.frequency_count}
                onChange={(e) =>
                  setValues((v) => ({ ...v, frequency_count: Number(e.target.value) || 1 }))
                }
                className={inputClass}
              />
            </label>
          )}
        </div>

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
          Color
          <div className="flex gap-2 pt-1">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValues((v) => ({ ...v, color: c }))}
                aria-label={`Color ${c}`}
                className="h-7 w-7 rounded-full"
                style={{
                  backgroundColor: c,
                  outline: values.color === c ? '2px solid #dae5da' : 'none',
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
            className="rounded-lg bg-habit-purple px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
