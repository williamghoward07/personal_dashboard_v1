'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { RugbySession } from '@/lib/types'

export interface RugbySessionFormValues {
  date: string
  duration_minutes: number | null
  notes: string | null
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none focus:border-primary-container'
const labelClass = 'flex flex-col gap-1 text-xs text-on-surface-variant'

export default function RugbySessionFormModal({
  isOpen,
  heading,
  initialValues,
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  initialValues?: Partial<RugbySession> | null
  onSave: (values: RugbySessionFormValues) => void
  onClose: () => void
}) {
  const [date, setDate] = useState(todayISO())
  const [duration, setDuration] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (isOpen) {
      setDate(initialValues?.date ?? todayISO())
      setDuration(initialValues?.duration_minutes ?? null)
      setNotes(initialValues?.notes ?? '')
    }
  }, [isOpen, initialValues])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!date) return
          onSave({ date, duration_minutes: duration, notes: notes || null })
        }}
        className="flex flex-col gap-4"
      >
        <h2 className="font-display text-sm font-semibold text-on-surface">{heading}</h2>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Date
            <input
              autoFocus
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Duration (minutes)
            <input
              type="number"
              value={duration ?? ''}
              onChange={(e) =>
                setDuration(e.target.value === '' ? null : Number(e.target.value))
              }
              className={inputClass}
            />
          </label>
        </div>

        <label className={labelClass}>
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Contact session, worked on tackling technique"
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
            className="rounded-lg bg-primary-container px-3 py-1.5 text-sm font-medium text-on-primary-container hover:brightness-110"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
