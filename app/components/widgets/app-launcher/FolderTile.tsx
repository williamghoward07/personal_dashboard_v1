'use client'

import { ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Accent } from '@/lib/theme'
import { ACCENT_BAR } from '@/lib/theme'
import type { QuickLink } from '@/lib/types'
import LinkTile, { linkDragId } from './LinkTile'

export interface FolderGroup {
  id: string
  name: string
  color: Accent
  isVirtual: boolean
  links: QuickLink[]
}

export const folderDragId = (id: string) => `folder:${id}`
export const folderDropId = (key: string) => `drop:${key}`

const toolbarButtonClass =
  'rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'

export default function FolderTile({
  folder,
  isExpanded,
  isLinkDropTarget,
  pinnedIds,
  onToggleExpand,
  onAddLink,
  onEdit,
  onDelete,
  onEditLink,
  onDeleteLink,
  onTogglePinLink,
}: {
  folder: FolderGroup
  isExpanded: boolean
  // A link is being dragged over this folder (or one of its links).
  isLinkDropTarget: boolean
  // ids currently in the launcher's `launcher_link_ids` array.
  pinnedIds: ReadonlySet<string>
  onToggleExpand: () => void
  onAddLink: () => void
  onEdit: () => void
  onDelete: () => void
  onEditLink: (link: QuickLink) => void
  onDeleteLink: (link: QuickLink) => void
  onTogglePinLink: (link: QuickLink) => void
}) {
  // The tile is two dnd-kit nodes: a sortable folder (moved by its grip)
  // and a drop zone covering the whole tile, so a link can be dropped
  // into a collapsed or empty folder.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folderDragId(folder.id),
    data: { type: 'folder' },
    disabled: folder.isVirtual,
  })
  const { setNodeRef: setDropRef } = useDroppable({
    id: folderDropId(folder.id),
    data: { type: 'folder-drop', folderKey: folder.id },
  })

  const style = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    transition: transition ?? undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'relative z-20 opacity-70' : undefined}>
      <div
        ref={setDropRef}
        className={`flex flex-col gap-2 rounded-lg border bg-surface-container-low p-3 transition-colors ${
          isLinkDropTarget ? 'border-outline bg-surface-container' : 'border-outline-variant'
        }`}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={isExpanded}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
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

          <div className="ml-1 flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onAddLink}
              aria-label={`Add a link to ${folder.name}`}
              title="Add a link here"
              className={toolbarButtonClass}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            {!folder.isVirtual && (
              <>
                <button
                  type="button"
                  {...attributes}
                  {...listeners}
                  aria-label={`Reorder ${folder.name}`}
                  className={`${toolbarButtonClass} touch-none cursor-grab active:cursor-grabbing`}
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={onEdit} aria-label={`Edit ${folder.name}`} className={toolbarButtonClass}>
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
              </>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="flex flex-col gap-1 border-t border-outline-variant/50 pt-2">
            <SortableContext items={folder.links.map((l) => linkDragId(l.id))} strategy={verticalListSortingStrategy}>
              {folder.links.length === 0 ? (
                <p className="px-1.5 py-1 text-xs text-on-surface-variant">
                  {isLinkDropTarget ? 'Drop to move here.' : 'No links here yet.'}
                </p>
              ) : (
                folder.links.map((link) => (
                  <LinkTile
                    key={link.id}
                    link={link}
                    folderKey={folder.id}
                    isPinned={pinnedIds.has(link.id)}
                    onEdit={() => onEditLink(link)}
                    onDelete={() => onDeleteLink(link)}
                    onTogglePin={() => onTogglePinLink(link)}
                  />
                ))
              )}
            </SortableContext>
          </div>
        )}
      </div>
    </div>
  )
}
