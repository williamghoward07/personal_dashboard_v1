'use client'

import { Copy, Pencil, Trash2 } from 'lucide-react'
import type { PerplexityLink } from '@/lib/types'

export default function PerplexityLinkCard({
  link,
  copied,
  onCopy,
  onEdit,
  onDelete,
}: {
  link: PerplexityLink
  copied: boolean
  onCopy: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const displayTitle = link.title || 'Untitled chat'

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container p-3">
      <div className="flex items-start justify-between gap-2">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-bold text-on-surface hover:underline"
        >
          {displayTitle}
        </a>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onCopy}
            aria-label={`Copy link for ${displayTitle}`}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${displayTitle}`}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${displayTitle}`}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <span className="truncate text-xs text-on-surface-variant">{link.url}</span>
      <span
        className={`text-[10px] text-primary-container transition-opacity ${
          copied ? 'opacity-100' : 'opacity-0'
        }`}
      >
        Copied to clipboard
      </span>
    </div>
  )
}
