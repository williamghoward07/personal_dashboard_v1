'use client'

import { GripVertical, Pencil, Pin, PinOff, Trash2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import type { QuickLink } from '@/lib/types'
import { onActivateKey } from '@/lib/utils/a11y'
import FaviconTile from './FaviconTile'
import { domainOf, openQuickLink } from './shared'

export const linkDragId = (id: string) => `link:${id}`

export default function LinkTile({
  link,
  folderKey,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  link: QuickLink
  folderKey: string
  onEdit: () => void
  onDelete: () => void
  onTogglePin: () => void
}) {
  // Dragging starts from the grip only — the row itself opens the link.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: linkDragId(link.id),
    data: { type: 'link', folderKey },
  })

  const style = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    transition: transition ?? undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={() => openQuickLink(link)}
      onKeyDown={onActivateKey(() => openQuickLink(link))}
      className={`group flex cursor-pointer items-center gap-1.5 rounded-lg p-1.5 text-left hover:bg-surface-container-high ${
        isDragging ? 'relative z-10 bg-surface-container-high opacity-70' : ''
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Reorder ${link.title}`}
        className="shrink-0 touch-none cursor-grab rounded p-0.5 text-on-surface-variant/30 hover:text-on-surface-variant active:cursor-grabbing group-hover:text-on-surface-variant/60"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <FaviconTile
        title={link.title}
        url={link.url}
        faviconPath={link.favicon_path}
        faviconCustomUrl={link.favicon_custom_url}
        size="sm"
      />
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
