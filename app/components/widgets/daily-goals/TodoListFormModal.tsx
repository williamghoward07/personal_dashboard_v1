'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import Modal from '../../Modal'
import type { TodoList } from '@/lib/types'

// Drawn from the app's existing module-accent palette (lib/theme.ts) so a
// user-created list's color reads as "on brand" rather than an arbitrary
// hex the design system doesn't otherwise use.
const COLOR_SWATCHES = [
  'var(--color-primary-container)',
  'var(--color-secondary-container)',
  'var(--color-academic-orange)',
  'var(--color-research-pink)',
  'var(--color-habit-purple)',
  'var(--color-people-amber)',
  'var(--color-tertiary-container)',
  'var(--color-outline)',
]

export default function TodoListFormModal({
  isOpen,
  heading,
  initialValues,
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  initialValues?: Partial<TodoList> | null
  onSave: (values: { name: string; color: string }) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLOR_SWATCHES[0])

  useEffect(() => {
    if (isOpen) {
      setName(initialValues?.name ?? '')
      setColor(initialValues?.color ?? COLOR_SWATCHES[0])
    }
  }, [isOpen, initialValues])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const trimmed = name.trim()
          if (!trimmed) return
          onSave({ name: trimmed, color })
        }}
        className="flex flex-col gap-3"
      >
        <h2 className="font-display text-sm font-semibold text-on-surface">{heading}</h2>

        <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary-container"
          />
        </label>

        <div className="flex flex-col gap-1 text-xs text-on-surface-variant">
          Color
          <div className="flex flex-wrap gap-2">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                aria-label={`Color ${swatch}`}
                aria-pressed={color === swatch}
                style={{ backgroundColor: swatch }}
                className="flex h-6 w-6 items-center justify-center rounded-full"
              >
                {color === swatch && <Check className="h-3.5 w-3.5 text-black/70" strokeWidth={3} />}
              </button>
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
            className="rounded-lg bg-primary-container px-3 py-1.5 text-sm font-medium text-on-primary-container hover:brightness-110"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
