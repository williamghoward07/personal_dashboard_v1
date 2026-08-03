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
        <h2 className="text-sm font-semibold text-black/80 dark:text-white/80">
          {heading}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
            Date
            <input
              autoFocus
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
            Duration (minutes)
            <input
              type="number"
              value={duration ?? ''}
              onChange={(e) =>
                setDuration(e.target.value === '' ? null : Number(e.target.value))
              }
              className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Contact session, worked on tackling technique"
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-black/80 px-3 py-1.5 text-sm text-white dark:bg-white/80 dark:text-black"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
