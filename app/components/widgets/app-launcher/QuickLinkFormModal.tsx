'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { LinkFolder, QuickLink } from '@/lib/types'
import { inputClass, labelClass } from './shared'

export interface QuickLinkFormValues {
  title: string
  url: string
  folder_id: string | null
  is_pinned: boolean
}

const EMPTY: QuickLinkFormValues = { title: '', url: '', folder_id: null, is_pinned: false }

export default function QuickLinkFormModal({
  isOpen,
  heading,
  folders,
  initialValues,
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  folders: LinkFolder[]
  initialValues?: Pick<QuickLink, 'title' | 'url' | 'folder_id' | 'is_pinned'> | null
  onSave: (values: QuickLinkFormValues) => void
  onClose: () => void
}) {
  const [values, setValues] = useState<QuickLinkFormValues>(EMPTY)

  useEffect(() => {
    if (isOpen) {
      setValues({
        title: initialValues?.title ?? '',
        url: initialValues?.url ?? '',
        folder_id: initialValues?.folder_id ?? null,
        is_pinned: initialValues?.is_pinned ?? false,
      })
    }
  }, [isOpen, initialValues])

  if (!isOpen) return null

  const canSubmit = values.title.trim().length > 0 && values.url.trim().length > 0

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return
          onSave({ ...values, title: values.title.trim(), url: values.url.trim() })
        }}
        className="flex flex-col gap-4"
      >
        <h2 className="font-display text-sm font-semibold text-on-surface">{heading}</h2>

        <label className={labelClass}>
          Title
          <input
            autoFocus
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            placeholder="e.g. Canvas"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          URL
          <input
            type="url"
            value={values.url}
            onChange={(e) => setValues((v) => ({ ...v, url: e.target.value }))}
            placeholder="https://example.com"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Folder
          <select
            value={values.folder_id ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, folder_id: e.target.value || null }))}
            className={inputClass}
          >
            <option value="">Unfiled</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs text-on-surface-variant">
          <input
            type="checkbox"
            checked={values.is_pinned}
            onChange={(e) => setValues((v) => ({ ...v, is_pinned: e.target.checked }))}
            className="accent-outline"
          />
          Pin to homepage
        </label>

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
            disabled={!canSubmit}
            className="rounded-lg bg-outline px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
