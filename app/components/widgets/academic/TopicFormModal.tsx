'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { Topic } from '@/lib/types'

export interface TopicFormValues {
  name: string
  confidence: number | null
}

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
        <h2 className="text-sm font-semibold text-black/80 dark:text-white/80">
          {heading}
        </h2>
        <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Fluvial processes"
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
          Confidence (1–5)
          <input
            type="number"
            min={1}
            max={5}
            value={confidence ?? ''}
            onChange={(e) =>
              setConfidence(e.target.value === '' ? null : Number(e.target.value))
            }
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
