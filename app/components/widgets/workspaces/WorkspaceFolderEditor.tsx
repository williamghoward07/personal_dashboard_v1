'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Accent } from '@/lib/theme'
import type { WorkspaceFolder } from '@/lib/types'
import { WORKSPACE_ACCENTS, isAccent, moveTargets } from '@/lib/workspaces/folders'
import AccentPicker from '../../AccentPicker'
import { ghostButtonClass, inputClass, labelClass, primaryButtonClass } from './shared'

export interface FolderEditorValues {
  name: string
  color: string | null
  parent_id: string | null
}

// Name + colour (+ location and delete when editing an existing folder).
// Rendered inside a Popover; `close` dismisses it.
export default function WorkspaceFolderEditor({
  folder,
  folders,
  submitLabel,
  onSave,
  onDelete,
  close,
}: {
  // Omitted when creating a new folder (it goes in the current folder).
  folder?: WorkspaceFolder
  folders: WorkspaceFolder[]
  submitLabel: string
  onSave: (values: FolderEditorValues) => void
  onDelete?: () => void
  close: () => void
}) {
  const [name, setName] = useState(folder?.name ?? '')
  const [color, setColor] = useState<Accent | null>(isAccent(folder?.color) ? (folder!.color as Accent) : null)
  const [parentId, setParentId] = useState<string | null>(folder?.parent_id ?? null)
  const targets = folder ? moveTargets(folders, folder.id) : []

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        onSave({ name: name.trim(), color, parent_id: parentId })
        close()
      }}
      className="flex flex-col gap-3"
    >
      <label className={labelClass}>
        Folder name
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Uni, Year 2, Side projects"
          className={inputClass}
        />
      </label>

      <div className={labelClass}>
        Colour
        <AccentPicker value={color} options={WORKSPACE_ACCENTS} noneLabel="Inherit from parent" onChange={setColor} />
        <span className="text-[11px]">Workspaces inside use this unless they have their own colour.</span>
      </div>

      {folder && (
        <label className={labelClass}>
          Inside
          <select value={parentId ?? ''} onChange={(e) => setParentId(e.target.value || null)} className={inputClass}>
            {targets.map((target) => (
              <option key={target.id ?? 'top'} value={target.id ?? ''}>
                {`${'  '.repeat(Math.max(0, target.depth - 1))}${target.label}`}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex items-center gap-2">
        {onDelete && (
          <button
            type="button"
            onClick={() => {
              close()
              onDelete()
            }}
            className="mr-auto flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Delete
          </button>
        )}
        <button type="button" onClick={close} className={`${ghostButtonClass} ${onDelete ? '' : 'ml-auto'}`}>
          Cancel
        </button>
        <button type="submit" disabled={!name.trim()} className={primaryButtonClass}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
