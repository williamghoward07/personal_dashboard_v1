'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { Accent } from '@/lib/theme'
import type { LinkFolder } from '@/lib/types'
import AccentPicker from '../../AccentPicker'
import { inputClass, labelClass } from './shared'

export interface LinkFolderFormValues {
  name: string
  color: Accent
}

// No teal — link_folders' check constraint predates that accent.
const COLOR_OPTIONS: Accent[] = ['neutral', 'mint', 'blue', 'orange', 'pink', 'purple', 'amber', 'crimson']

const EMPTY: LinkFolderFormValues = { name: '', color: 'neutral' }

export default function LinkFolderFormModal({
  isOpen,
  heading,
  initialValues,
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  initialValues?: Pick<LinkFolder, 'name' | 'color'> | null
  onSave: (values: LinkFolderFormValues) => void
  onClose: () => void
}) {
  const [values, setValues] = useState<LinkFolderFormValues>(EMPTY)

  useEffect(() => {
    if (isOpen) {
      setValues({
        name: initialValues?.name ?? '',
        color: (initialValues?.color as Accent) ?? 'neutral',
      })
    }
  }, [isOpen, initialValues])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!values.name.trim()) return
          onSave({ ...values, name: values.name.trim() })
        }}
        className="flex flex-col gap-4"
      >
        <h2 className="font-display text-sm font-semibold text-on-surface">{heading}</h2>

        <label className={labelClass}>
          Name
          <input
            autoFocus
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            placeholder="e.g. Uni tools"
            className={inputClass}
          />
        </label>

        <div className={labelClass}>
          Color
          <AccentPicker
            value={values.color}
            options={COLOR_OPTIONS}
            onChange={(c) => setValues((v) => ({ ...v, color: c ?? 'neutral' }))}
          />
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
            disabled={!values.name.trim()}
            className="rounded-lg bg-outline px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
