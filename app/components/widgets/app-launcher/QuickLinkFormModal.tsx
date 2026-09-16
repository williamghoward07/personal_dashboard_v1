'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { LinkFolder, QuickLink } from '@/lib/types'
import FaviconTile from './FaviconTile'
import { inputClass, labelClass } from './shared'

export interface QuickLinkFormValues {
  title: string
  url: string
  folder_id: string | null
  is_pinned: boolean
  favicon_custom_url: string | null
}

const EMPTY: QuickLinkFormValues = {
  title: '',
  url: '',
  folder_id: null,
  is_pinned: false,
  favicon_custom_url: null,
}

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
  initialValues?: Pick<
    QuickLink,
    'title' | 'url' | 'folder_id' | 'is_pinned' | 'favicon_custom_url' | 'favicon_path'
  > | null
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
        favicon_custom_url: initialValues?.favicon_custom_url ?? null,
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
          onSave({
            ...values,
            title: values.title.trim(),
            url: values.url.trim(),
            favicon_custom_url: values.favicon_custom_url?.trim() || null,
          })
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
          Icon
          <div className="flex items-center gap-2">
            <FaviconTile
              title={values.title}
              url={values.url}
              faviconPath={initialValues?.favicon_path ?? null}
              faviconCustomUrl={values.favicon_custom_url}
              size="sm"
            />
            <input
              type="url"
              value={values.favicon_custom_url ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, favicon_custom_url: e.target.value }))}
              placeholder="Custom icon URL (optional) — leave blank to auto-detect"
              className={`${inputClass} flex-1`}
            />
            {values.favicon_custom_url && (
              <button
                type="button"
                onClick={() => setValues((v) => ({ ...v, favicon_custom_url: null }))}
                className="shrink-0 text-xs text-on-surface-variant hover:text-on-surface"
              >
                Clear
              </button>
            )}
          </div>
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
