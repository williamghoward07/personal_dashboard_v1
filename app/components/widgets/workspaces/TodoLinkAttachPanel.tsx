'use client'

import { useMemo, useState } from 'react'
import type { WorkspaceLink } from '@/lib/types'
import { SOURCE_KINDS } from '@/lib/workspaces/kinds'
import { ghostButtonClass, primaryButtonClass } from './shared'

// Inverse of LinkTodoAttachPanel.tsx — attaches this workspace's sources to
// a todo. Same ported ResearchAttachModal checklist logic.
export default function TodoLinkAttachPanel({
  links,
  alreadyAttachedLinkIds,
  onAttach,
  onClose,
}: {
  links: WorkspaceLink[]
  alreadyAttachedLinkIds: string[]
  onAttach: (linkIds: string[]) => Promise<void>
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const available = useMemo(
    () => links.filter((l) => !alreadyAttachedLinkIds.includes(l.id)),
    [links, alreadyAttachedLinkIds]
  )

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="mt-1 flex flex-col gap-2 rounded-lg border border-outline-variant/60 bg-surface-container-lowest/60 p-2.5">
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/70">
        Attach sources
      </p>

      {available.length === 0 ? (
        <p className="text-xs text-on-surface-variant">No workspace sources available to attach.</p>
      ) : (
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {available.map((link) => (
            <li key={link.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs text-on-surface hover:bg-surface-container-high">
                <input
                  type="checkbox"
                  checked={selected.has(link.id)}
                  onChange={() => toggle(link.id)}
                  className="accent-workspace-teal"
                />
                <span className={`h-2 w-2 shrink-0 rounded-full ${SOURCE_KINDS[link.kind].dotClass}`} aria-hidden />
                <span className="truncate">{link.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostButtonClass}>
          Cancel
        </button>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => onAttach(Array.from(selected))}
          className={primaryButtonClass}
        >
          Attach
        </button>
      </div>
    </div>
  )
}
