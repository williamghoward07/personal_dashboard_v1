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
    <div className="flex flex-col gap-2 rounded-lg border border-black/10 bg-white/40 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-2">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-bold text-black/80 hover:underline dark:text-white/80"
        >
          {displayTitle}
        </a>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onCopy}
            aria-label={`Copy link for ${displayTitle}`}
            className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${displayTitle}`}
            className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${displayTitle}`}
            className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-red-600 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <span className="truncate text-xs text-black/40 dark:text-white/40">
        {link.url}
      </span>
      <span
        className={`text-[10px] text-[#006300] transition-opacity dark:text-[#0ca30c] ${
          copied ? 'opacity-100' : 'opacity-0'
        }`}
      >
        Copied to clipboard
      </span>
    </div>
  )
}
