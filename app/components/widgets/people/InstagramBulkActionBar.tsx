'use client'

import { useState } from 'react'
import { Download, Sparkles, Tag, Unlink, X } from 'lucide-react'

export default function InstagramBulkActionBar({
  selectedCount,
  autoMatchAvailable,
  onAutoMatch,
  categoryListId,
  onApplyCategory,
  onExport,
  onUnlink,
  onClear,
}: {
  selectedCount: number
  autoMatchAvailable: boolean
  onAutoMatch: () => void
  categoryListId: string
  onApplyCategory: (category: string) => void
  onExport: () => void
  onUnlink: () => void
  onClear: () => void
}) {
  const [category, setCategory] = useState('')

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-people-amber/30 bg-people-amber/5 px-2 py-1.5 text-xs">
      <span className="font-medium text-people-amber">{selectedCount} selected</span>

      <button
        type="button"
        onClick={onAutoMatch}
        disabled={!autoMatchAvailable}
        className="flex items-center gap-1 rounded border border-outline-variant px-2 py-1 text-on-surface-variant hover:border-people-amber/40 hover:text-people-amber disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Sparkles className="h-3 w-3" />
        Auto-match
      </button>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (category.trim()) {
            onApplyCategory(category.trim())
            setCategory('')
          }
        }}
        className="flex items-center gap-1"
      >
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list={categoryListId}
          placeholder="Category…"
          aria-label="Apply category to selected"
          className="w-24 rounded border border-outline-variant bg-surface-container-lowest px-1.5 py-1 text-on-surface outline-none focus:border-people-amber"
        />
        <button
          type="submit"
          disabled={!category.trim()}
          className="flex items-center gap-1 rounded border border-outline-variant px-2 py-1 text-on-surface-variant hover:border-people-amber/40 hover:text-people-amber disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Tag className="h-3 w-3" />
          Apply
        </button>
      </form>

      <button
        type="button"
        onClick={onExport}
        className="flex items-center gap-1 rounded border border-outline-variant px-2 py-1 text-on-surface-variant hover:border-people-amber/40 hover:text-people-amber"
      >
        <Download className="h-3 w-3" />
        Export
      </button>

      <button
        type="button"
        onClick={onUnlink}
        className="flex items-center gap-1 rounded border border-outline-variant px-2 py-1 text-on-surface-variant hover:border-error/40 hover:text-error"
      >
        <Unlink className="h-3 w-3" />
        Unlink
      </button>

      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="ml-auto rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
