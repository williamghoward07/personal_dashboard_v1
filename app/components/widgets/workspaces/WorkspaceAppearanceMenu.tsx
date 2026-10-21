'use client'

import { useState } from 'react'
import { Palette } from 'lucide-react'
import type { Accent } from '@/lib/theme'
import type { Workspace, WorkspaceFolder } from '@/lib/types'
import { WORKSPACE_ACCENTS, isAccent, moveTargets, resolveFolderAccent } from '@/lib/workspaces/folders'
import { normalizeModuleCode } from '@/lib/lectures/module-workspace'
import AccentPicker from '../../AccentPicker'
import Popover from '../../Popover'
import { iconButtonClass, inputClass, labelClass, microLabelClass } from './shared'

// Colour, folder and module code for one workspace, from its own page.
export default function WorkspaceAppearanceMenu({
  workspace,
  folders,
  onChange,
  open,
  onOpenChange,
}: {
  workspace: Workspace
  folders: WorkspaceFolder[]
  onChange: (patch: { color?: string | null; folder_id?: string | null; module_code?: string | null }) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const inherited = resolveFolderAccent(folders, workspace.folder_id)
  const targets = moveTargets(folders)
  const [codeDraft, setCodeDraft] = useState(workspace.module_code ?? '')
  const [codeError, setCodeError] = useState<string | null>(null)

  const saveCode = () => {
    const trimmed = codeDraft.trim()
    const code = trimmed ? normalizeModuleCode(trimmed) : null
    if (trimmed && !code) {
      setCodeError('Use a code like GEOG1081')
      return
    }
    setCodeError(null)
    setCodeDraft(code ?? '')
    if (code !== (workspace.module_code ?? null)) onChange({ module_code: code })
  }

  return (
    <Popover
      label="Colour, folder and module"
      align="end"
      panelClassName="w-80"
      className="self-center"
      open={open}
      onOpenChange={onOpenChange}
      trigger={(props) => (
        <button type="button" {...props} aria-label="Colour, folder and module" title="Colour, folder and module" className={iconButtonClass}>
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

        <label className={labelClass}>
          Module code
          <input
            value={codeDraft}
            onChange={(e) => setCodeDraft(e.target.value)}
            onBlur={saveCode}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveCode()
            }}
            placeholder="e.g. GEOG1081"
            className={inputClass}
          />
          <span className={`text-[11px] ${codeError ? 'text-error' : 'text-on-surface-variant'}`}>
            {codeError ??
              'Links this workspace to that module’s lectures on your timetable and moves it to the Lectures tab.'}
          </span>
        </label>
      </div>
    </Popover>
  )
}
