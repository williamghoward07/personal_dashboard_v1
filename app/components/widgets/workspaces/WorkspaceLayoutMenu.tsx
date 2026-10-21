'use client'

import { Eye, EyeOff, SlidersHorizontal } from 'lucide-react'
import type { WorkspaceSectionKey } from '@/lib/types'
import { SECTION_KEYS, SECTION_LABELS } from '@/lib/workspaces/layout'
import Popover from '../../Popover'
import { actionButtonClass, microLabelClass } from './shared'

const SECTION_HINTS: Record<WorkspaceSectionKey, string> = {
  stats: 'Progress rings along the top',
  sources: 'Links, papers and data',
  readings: "Each week's reading list, with progress",
  actions: 'Todos filed under this workspace',
  log: 'Dated notes and #tags',
  time: 'Hours studied (e.g. from Opal), as a stat card',
}

// Per-workspace "which sections exist on this page" — e.g. a side project
// that only needs Sources and the Thinking log, or a uni module that also
// wants Weekly readings and Study time (both start hidden). Hiding never
// deletes data.
export default function WorkspaceLayoutMenu({
  hidden,
  onToggle,
  exclude = [],
}: {
  hidden: WorkspaceSectionKey[]
  onToggle: (key: WorkspaceSectionKey) => void
  /** Sections this workspace can't show (module workspaces: weekly readings). */
  exclude?: WorkspaceSectionKey[]
}) {
  const keys = SECTION_KEYS.filter((key) => !exclude.includes(key))
  const hiddenCount = hidden.filter((key) => keys.includes(key)).length
  return (
    <Popover
      label="Workspace layout"
      align="end"
      panelClassName="w-72"
      trigger={(props) => (
        <button type="button" {...props} className={actionButtonClass}>
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
          Layout
          {hiddenCount > 0 && (
            <span className="rounded-full bg-surface-container-highest px-1.5 text-[10px] tabular-nums">
              {hiddenCount} hidden
            </span>
          )}
        </button>
      )}
    >
      <div className="flex flex-col gap-2">
        <span className={microLabelClass}>Show on this workspace</span>
        <ul className="flex flex-col gap-1">
          {keys.map((key) => {
            const shown = !hidden.includes(key)
            const Icon = shown ? Eye : EyeOff
            return (
              <li key={key}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={shown}
                  onClick={() => onToggle(key)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-container-high"
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${shown ? 'text-ws-accent' : 'text-on-surface-variant/50'}`}
                    strokeWidth={1.75}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`text-sm ${shown ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}>
                      {SECTION_LABELS[key]}
                    </span>
                    <span className="truncate text-[11px] text-on-surface-variant">{SECTION_HINTS[key]}</span>
                  </span>
                  <span
                    aria-hidden
                    className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
                      shown ? 'bg-ws-accent' : 'bg-surface-container-highest'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-3 w-3 rounded-full bg-surface-container-lowest transition-[left] ${
                        shown ? 'left-3.5' : 'left-0.5'
                      }`}
                    />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="text-[11px] leading-relaxed text-on-surface-variant">
          Hidden sections keep their data — turn them back on any time. To just make one smaller, use the chevron on
          the section itself.
        </p>
      </div>
    </Popover>
  )
}
