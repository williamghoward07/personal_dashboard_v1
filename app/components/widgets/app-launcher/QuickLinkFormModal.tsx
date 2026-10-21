'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import Modal from '../../Modal'
import type { LinkFolder, QuickLink } from '@/lib/types'
import { findDuplicateUrl } from '@/lib/utils/url'
import FaviconTile from './FaviconTile'
import { inputClass, labelClass } from './shared'

export interface QuickLinkFormValues {
  title: string
  url: string
  folder_id: string | null
  favicon_custom_url: string | null
}

const EMPTY: QuickLinkFormValues = {
  title: '',
  url: '',
  folder_id: null,
  favicon_custom_url: null,
}

export default function QuickLinkFormModal({
  isOpen,
  heading,
  folders,
  initialValues,
  existingLinks = [],
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  folders: LinkFolder[]
  initialValues?: Pick<QuickLink, 'title' | 'url' | 'folder_id' | 'favicon_custom_url' | 'favicon_path'> | null
  /** Other links to check the URL against (exclude the one being edited). */
  existingLinks?: QuickLink[]
  onSave: (values: QuickLinkFormValues) => Promise<void> | void
  onClose: () => void
}) {
  const [values, setValues] = useState<QuickLinkFormValues>(EMPTY)
  // Saving fetches the favicon first, which can take a few seconds — the
  // flag stops a second click from inserting the link twice.
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setSaving(false)
      setValues({
        title: initialValues?.title ?? '',
        url: initialValues?.url ?? '',
        folder_id: initialValues?.folder_id ?? null,
        favicon_custom_url: initialValues?.favicon_custom_url ?? null,
      })
    }
  }, [isOpen, initialValues])

  if (!isOpen) return null

  const canSubmit = values.title.trim().length > 0 && values.url.trim().length > 0
  const duplicate = values.url.trim() ? findDuplicateUrl(existingLinks, values.url) : null
  const duplicateFolder = duplicate?.folder_id ? folders.find((f) => f.id === duplicate.folder_id)?.name : null

  return (
    <Modal onClose={saving ? () => {} : onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!canSubmit || saving) return
          setSaving(true)
          try {
            await onSave({
              ...values,
              title: values.title.trim(),
              url: values.url.trim(),
              favicon_custom_url: values.favicon_custom_url?.trim() || null,
            })
          } finally {
            setSaving(false)
          }
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
          {duplicate && (
            <span className="flex items-center gap-1.5 text-xs text-people-amber">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Already in your library as &ldquo;{duplicate.title}&rdquo;
              {duplicateFolder ? ` · ${duplicateFolder}` : ''}
              {duplicate.archived_at ? ' (archived)' : ''}
            </span>
          )}
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

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || saving}
            aria-busy={saving}
            className="flex items-center gap-1.5 rounded-lg bg-outline px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110 disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : duplicate ? 'Add anyway' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
