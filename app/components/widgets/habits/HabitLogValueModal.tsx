'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { Habit } from '@/lib/types'

export default function HabitLogValueModal({
  isOpen,
  habit,
  initialValue,
  onSave,
  onClose,
}: {
  isOpen: boolean
  habit: Habit | null
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
    'rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/40'

  return (
    <Modal onClose={onClose} variant="dark">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const num = Number(value)
          if (Number.isNaN(num) || num < 0) return
          onSave(num)
        }}
        className="flex flex-col gap-4"
      >
        <h2 className="text-sm font-semibold text-white">
          {habit.icon} {habit.name} — today
        </h2>
        <label className="flex flex-col gap-1 text-xs text-white/60">
          {habit.unit ? `Value (${habit.unit})` : 'Value'}
          {habit.target_value != null && (
            <span className="text-white/30">
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
            className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-white/90 px-3 py-1.5 text-sm text-[#0b0f1a]"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
