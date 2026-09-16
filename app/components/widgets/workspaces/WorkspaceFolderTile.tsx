'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Folder, GripVertical, MoreHorizontal } from 'lucide-react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Accent } from '@/lib/theme'
import type { WorkspaceFolder } from '@/lib/types'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import Popover from '../../Popover'
import WorkspaceFolderEditor, { type FolderEditorValues } from './WorkspaceFolderEditor'
import { accentVars, iconButtonClass, wsAccentStyle } from './shared'

export const folderDropId = (folderId: string | null) => `drop:${folderId ?? 'root'}`

// A folder on the Workspaces index: opens on click, drags by its grip, and
// accepts workspaces/folders dropped onto it.
export default function WorkspaceFolderTile({
  folder,
  folders,
  accent,
  counts,
  isDropTarget,
  onSave,
  onDelete,
}: {
  folder: WorkspaceFolder
  folders: WorkspaceFolder[]
  accent: Accent
  counts: { workspaces: number; subfolders: number }
  isDropTarget: boolean
  onSave: (values: FolderEditorValues) => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: `wf:${folder.id}`, data: { type: 'folder', id: folder.id } })
  const { setNodeRef: setDropRef } = useDroppable({
    id: folderDropId(folder.id),
    data: { type: 'drop', folderId: folder.id },
  })

  const summary = [
    `${counts.workspaces} workspace${counts.workspaces === 1 ? '' : 's'}`,
    counts.subfolders > 0 && `${counts.subfolders} folder${counts.subfolders === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li
      ref={(node) => {
        setDragRef(node)
        setDropRef(node)
      }}
      style={accentVars(accent)}
      className={`${isDragging ? 'opacity-40' : ''} ${menuOpen ? 'relative z-10' : ''}`}
    >
      <ModuleGlassCard
        style={wsAccentStyle}
        size="sm"
        className={`flex h-full items-center gap-2 transition-colors ${
          isDropTarget ? 'outline-2 outline-offset-2 outline-ws-accent' : ''
        }`}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Move ${folder.name}`}
          className="shrink-0 touch-none cursor-grab rounded p-1 text-on-surface-variant/40 hover:bg-surface-container-high hover:text-on-surface-variant active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <Link href={`/workspaces?folder=${folder.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ws-accent/30 bg-ws-accent/10 text-ws-accent"
            aria-hidden
          >
            <Folder className="h-4.5 w-4.5" strokeWidth={1.75} fill="currentColor" fillOpacity={0.2} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-on-surface">{folder.name}</span>
            <span className="truncate text-xs text-on-surface-variant">{summary}</span>
          </span>
        </Link>

        <Popover
          label={`Edit ${folder.name}`}
          align="end"
          panelClassName="w-80"
          open={menuOpen}
          onOpenChange={setMenuOpen}
          trigger={(props) => (
            <button type="button" {...props} aria-label={`Edit ${folder.name}`} className={iconButtonClass}>
              <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        >
          {(close) => (
            <WorkspaceFolderEditor
              folder={folder}
              folders={folders}
              submitLabel="Save"
              onSave={onSave}
              onDelete={onDelete}
              close={close}
            />
          )}
        </Popover>
      </ModuleGlassCard>
    </li>
  )
}
