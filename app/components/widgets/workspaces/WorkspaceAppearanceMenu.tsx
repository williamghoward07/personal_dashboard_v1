'use client'

import { Palette } from 'lucide-react'
import type { Accent } from '@/lib/theme'
import type { Workspace, WorkspaceFolder } from '@/lib/types'
import { WORKSPACE_ACCENTS, isAccent, moveTargets, resolveFolderAccent } from '@/lib/workspaces/folders'
import AccentPicker from '../../AccentPicker'
import Popover from '../../Popover'
import { iconButtonClass, inputClass, labelClass, microLabelClass } from './shared'

// Colour + folder for one workspace, from its own page.
export default function WorkspaceAppearanceMenu({
  workspace,
  folders,
  onChange,
  open,
  onOpenChange,
}: {
  workspace: Workspace
  folders: WorkspaceFolder[]
  onChange: (patch: { color?: string | null; folder_id?: string | null }) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const inherited = resolveFolderAccent(folders, workspace.folder_id)
  const targets = moveTargets(folders)

  return (
    <Popover
      label="Colour and folder"
      align="end"
      panelClassName="w-80"
      className="self-center"
      open={open}
      onOpenChange={onOpenChange}
      trigger={(props) => (
        <button type="button" {...props} aria-label="Colour and folder" title="Colour and folder" className={iconButtonClass}>
          <Palette className="h-4 w-4 text-ws-accent" strokeWidth={1.75} />
        </button>
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className={microLabelClass}>Colour</span>
          <AccentPicker
            value={isAccent(workspace.color) ? (workspace.color as Accent) : null}
            options={WORKSPACE_ACCENTS}
            noneLabel={inherited ? `Use folder colour (${inherited})` : 'Default (teal)'}
            onChange={(color) => onChange({ color })}
          />
          <p className="text-[11px] text-on-surface-variant">
            {isAccent(workspace.color)
              ? 'This workspace has its own colour.'
              : inherited
                ? `Following its folder's colour (${inherited}).`
                : 'No colour set — using the default teal.'}
          </p>
        </div>

        <label className={labelClass}>
          Folder
          <select
            value={workspace.folder_id ?? ''}
            onChange={(e) => onChange({ folder_id: e.target.value || null })}
            className={inputClass}
          >
            {targets.map((target) => (
              <option key={target.id ?? 'top'} value={target.id ?? ''}>
                {`${'  '.repeat(Math.max(0, target.depth - 1))}${target.label}`}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Popover>
  )
}
