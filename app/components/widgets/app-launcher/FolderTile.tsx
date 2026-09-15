'use client'

import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import type { Accent } from '@/lib/theme'
import { ACCENT_BAR } from '@/lib/theme'
import type { QuickLink } from '@/lib/types'
import LinkTile from './LinkTile'

export interface FolderGroup {
  id: string
  name: string
  color: Accent
  isVirtual: boolean
  links: QuickLink[]
}

export default function FolderTile({
  folder,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onEditLink,
  onDeleteLink,
  onTogglePinLink,
  onMoveLinkUp,
  onMoveLinkDown,
}: {
  folder: FolderGroup
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onDelete: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onEditLink: (link: QuickLink) => void
  onDeleteLink: (link: QuickLink) => void
  onTogglePinLink: (link: QuickLink) => void
  onMoveLinkUp: (link: QuickLink) => void
  onMoveLinkDown: (link: QuickLink) => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container-low p-3">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex items-center gap-2 text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-on-surface-variant" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-on-surface-variant" />
        )}
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ACCENT_BAR[folder.color]}`} />
        <span className="flex-1 truncate text-sm font-semibold text-on-surface">{folder.name}</span>
        <span className="shrink-0 text-xs text-on-surface-variant">{folder.links.length}</span>
      </button>

      {!folder.isVirtual && (
        <div className="flex shrink-0 justify-end gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={`Move ${folder.name} up`}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={`Move ${folder.name} down`}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-30"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${folder.name}`}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${folder.name}`}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isExpanded && (
        <div className="flex flex-col gap-1 border-t border-outline-variant/50 pt-2">
          {folder.links.length === 0 ? (
            <p className="text-xs text-on-surface-variant">No links here yet.</p>
          ) : (
            folder.links.map((link, index) => (
              <LinkTile
                key={link.id}
                link={link}
                canMoveUp={index > 0}
                canMoveDown={index < folder.links.length - 1}
                onMoveUp={() => onMoveLinkUp(link)}
                onMoveDown={() => onMoveLinkDown(link)}
                onEdit={() => onEditLink(link)}
                onDelete={() => onDeleteLink(link)}
                onTogglePin={() => onTogglePinLink(link)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
