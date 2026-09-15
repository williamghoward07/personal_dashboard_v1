'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { LinkFolder } from '@/lib/types'
import { inputClass } from './shared'

export type DeleteFolderAction = { type: 'reassign'; targetFolderId: string } | { type: 'unfile' }

/**
 * Used only when the folder being deleted has 1+ links — ConfirmDialog
 * can't host this reassign-or-unfile choice (it only renders a plain
 * message, no slot for extra content). A folder with zero links skips
 * this entirely and uses ConfirmDialog instead (see AppLibraryBoard).
 */
export default function DeleteFolderModal({
  folder,
  linkCount,
  otherFolders,
  onCancel,
  onConfirm,
}: {
  folder: LinkFolder | null
  linkCount: number
  otherFolders: LinkFolder[]
  onCancel: () => void
  onConfirm: (action: DeleteFolderAction) => void
}) {
  const [mode, setMode] = useState<'reassign' | 'unfile'>(otherFolders.length > 0 ? 'reassign' : 'unfile')
  const [targetFolderId, setTargetFolderId] = useState(otherFolders[0]?.id ?? '')

  useEffect(() => {
    if (folder) {
      setMode(otherFolders.length > 0 ? 'reassign' : 'unfile')
      setTargetFolderId(otherFolders[0]?.id ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- otherFolders is derived fresh each render from the same folder list, comparing by folder.id is sufficient to reset on open
  }, [folder?.id])

  if (!folder) return null

  return (
    <Modal onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-on-surface-variant">
          {`"${folder.name}" has ${linkCount} link${linkCount === 1 ? '' : 's'}. What should happen to them?`}
        </p>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-on-surface">
            <input
              type="radio"
              name="delete-folder-action"
              checked={mode === 'reassign'}
              disabled={otherFolders.length === 0}
              onChange={() => setMode('reassign')}
              className="accent-outline"
            />
            Reassign to another folder
          </label>
          {mode === 'reassign' && (
            <select
              value={targetFolderId}
              onChange={(e) => setTargetFolderId(e.target.value)}
              className={`${inputClass} ml-6`}
            >
              {otherFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}

          <label className="flex items-center gap-2 text-sm text-on-surface">
            <input
              type="radio"
              name="delete-folder-action"
              checked={mode === 'unfile'}
              onChange={() => setMode('unfile')}
              className="accent-outline"
            />
            Unfile them
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm(mode === 'reassign' ? { type: 'reassign', targetFolderId } : { type: 'unfile' })
            }
            disabled={mode === 'reassign' && !targetFolderId}
            className="rounded-lg bg-error-container px-3 py-1.5 text-sm text-on-error-container hover:brightness-110 disabled:opacity-40"
          >
            Delete folder
          </button>
        </div>
      </div>
    </Modal>
  )
}
