'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { Topic } from '@/lib/types'

export interface TopicFormValues {
  name: string
  confidence: number | null
}

const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none focus:border-academic-orange'
const labelClass = 'flex flex-col gap-1 text-xs text-on-surface-variant'

export default function TopicFormModal({
  isOpen,
  heading,
  initialValues,
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  initialValues?: Partial<Topic> | null
  onSave: (values: TopicFormValues) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [confidence, setConfidence] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      setName(initialValues?.name ?? '')
      setConfidence(initialValues?.confidence ?? null)
    }
  }, [isOpen, initialValues])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          onSave({ name: name.trim(), confidence })
        }}
        className="flex flex-col gap-4"
      >
        <h2 className="font-display text-sm font-semibold text-on-surface">{heading}</h2>
        <label className={labelClass}>
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Fluvial processes"
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Confidence (1–5)
          <input
            type="number"
            min={1}
            max={5}
            value={confidence ?? ''}
            onChange={(e) =>
              setConfidence(e.target.value === '' ? null : Number(e.target.value))
            }
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
            className="rounded-lg bg-academic-orange px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
