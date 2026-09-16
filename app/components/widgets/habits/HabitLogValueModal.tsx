'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { DailyGoalHabit } from '@/lib/types'
import { londonDayBoundsUTC } from '@/lib/google/london-day'

// Europe/London calendar day, like the rest of the app.
function todayISO() {
  return londonDayBoundsUTC().startDateKey
}

export default function HabitLogValueModal({
  isOpen,
  habit,
  date,
  initialValue,
  onSave,
  onClose,
}: {
  isOpen: boolean
  habit: DailyGoalHabit | null
  // Defaults to today when omitted — every existing call site (the
  // header's quick-log button) still means "log today's value".
  date?: string
  initialValue: number | null
  onSave: (value: number) => void
  onClose: () => void
}) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (isOpen) setValue(initialValue != null ? String(initialValue) : '')
  }, [isOpen, initialValue])

  if (!isOpen || !habit) return null

  const inputClass =
    'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-habit-purple'
  const isToday = (date ?? todayISO()) === todayISO()

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const num = Number(value)
          if (Number.isNaN(num) || num < 0) return
          onSave(num)
        }}
        className="flex flex-col gap-4"
      >
        <h2 className="font-display text-sm font-semibold text-on-surface">
          {habit.icon} {habit.name} — {isToday ? 'today' : date}
        </h2>
        <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
          {habit.unit ? `Value (${habit.unit})` : 'Value'}
          {habit.target_value != null && (
            <span className="text-on-surface-variant/70">
              Target: {habit.target_value} {habit.unit}
            </span>
          )}
          <input
            autoFocus
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="flex justify-end gap-2">
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
