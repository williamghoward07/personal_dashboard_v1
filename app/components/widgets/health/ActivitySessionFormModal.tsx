'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { ActivitySession } from '@/lib/types'

export interface ActivitySessionFormValues {
  occurred_at: string
  activity_type: string
  duration_minutes: number | null
  distance_km: number | null
  notes: string | null
}

const ACTIVITY_TYPE_SUGGESTIONS = ['Rugby', 'Running', 'Gym', 'Swimming', 'Cycling', 'Other']

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none focus:border-primary-container'
const labelClass = 'flex flex-col gap-1 text-xs text-on-surface-variant'

export default function ActivitySessionFormModal({
  isOpen,
  heading,
  initialValues,
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  initialValues?: Partial<ActivitySession> | null
  onSave: (values: ActivitySessionFormValues) => void
  onClose: () => void
}) {
  const [date, setDate] = useState(todayISO())
  const [activityType, setActivityType] = useState('')
  const [duration, setDuration] = useState<number | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (isOpen) {
      setDate(initialValues?.occurred_at ? initialValues.occurred_at.slice(0, 10) : todayISO())
      setActivityType(initialValues?.activity_type ?? '')
      setDuration(initialValues?.duration_minutes ?? null)
      setDistance(initialValues?.distance_km ?? null)
      setNotes(initialValues?.notes ?? '')
    }
  }, [isOpen, initialValues])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!date || !activityType.trim()) return
          onSave({
            occurred_at: date,
            activity_type: activityType.trim(),
            duration_minutes: duration,
            distance_km: distance,
            notes: notes || null,
          })
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
            Activity type
            <input
              list="activity-type-suggestions"
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              placeholder="e.g. Running"
              className={inputClass}
            />
            <datalist id="activity-type-suggestions">
              {ACTIVITY_TYPE_SUGGESTIONS.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Duration (minutes)
            <input
              type="number"
              min={0}
              value={duration ?? ''}
              onChange={(e) => setDuration(e.target.value === '' ? null : Number(e.target.value))}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Distance (km)
            <input
              type="number"
              min={0}
              step="0.01"
              value={distance ?? ''}
              onChange={(e) => setDistance(e.target.value === '' ? null : Number(e.target.value))}
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
