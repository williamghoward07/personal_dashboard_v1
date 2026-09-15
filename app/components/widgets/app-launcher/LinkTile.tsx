'use client'

import { ArrowDown, ArrowUp, Pencil, Pin, PinOff, Trash2 } from 'lucide-react'
import type { QuickLink } from '@/lib/types'
import FaviconTile from './FaviconTile'
import { domainOf, openQuickLink } from './shared'

export default function LinkTile({
  link,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  link: QuickLink
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onEdit: () => void
  onDelete: () => void
  onTogglePin: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openQuickLink(link)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openQuickLink(link)
        }
      }}
      className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-left hover:bg-surface-container-high"
    >
      <FaviconTile title={link.title} url={link.url} faviconPath={link.favicon_path} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-on-surface">{link.title}</p>
        <p className="truncate text-[11px] text-on-surface-variant">{domainOf(link.url)}</p>
      </div>
      <div className="flex shrink-0 gap-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin()
          }}
          aria-label={link.is_pinned ? `Unpin ${link.title}` : `Pin ${link.title}`}
          className="rounded p-1 text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
        >
          {link.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onMoveUp()
          }}
          disabled={!canMoveUp}
          aria-label={`Move ${link.title} up`}
          className="rounded p-1 text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface disabled:opacity-30"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onMoveDown()
          }}
          disabled={!canMoveDown}
          aria-label={`Move ${link.title} down`}
          className="rounded p-1 text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface disabled:opacity-30"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          aria-label={`Edit ${link.title}`}
          className="rounded p-1 text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label={`Delete ${link.title}`}
          className="rounded p-1 text-on-surface-variant hover:bg-surface-container-highest hover:text-error"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
