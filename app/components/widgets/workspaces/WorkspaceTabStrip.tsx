'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Archive } from 'lucide-react'
import type { Workspace } from '@/lib/types'

// Switch between active workspaces without going back to the index, plus a
// collapsed archive shelf. The /workspaces list page remains the place to
// create one.
export default function WorkspaceTabStrip({
  workspaces,
  currentId,
}: {
  workspaces: Workspace[]
  currentId: string
}) {
  const [showArchived, setShowArchived] = useState(false)

  const active = useMemo(() => workspaces.filter((w) => !w.archived_at), [workspaces])
  const archived = useMemo(() => workspaces.filter((w) => w.archived_at), [workspaces])

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.map((w) => {
        const isCurrent = w.id === currentId
        return (
          <Link
            key={w.id}
            href={`/workspaces/${w.id}`}
            aria-current={isCurrent ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              isCurrent
                ? 'border-workspace-teal/40 bg-workspace-teal/10 text-workspace-teal'
                : 'border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface'
            }`}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isCurrent ? 'bg-workspace-teal' : 'bg-outline'}`} />
            <span className="max-w-50 truncate font-medium">{w.title}</span>
            {isCurrent && (
              <span className="font-display text-[10px] font-semibold uppercase tracking-wide">Active</span>
            )}
          </Link>
        )
      })}

      {archived.length > 0 && (
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          aria-expanded={showArchived}
          className="flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:border-outline hover:text-on-surface"
        >
          <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="font-display font-semibold uppercase tracking-wide">Archived workspaces</span>
          <span className="tabular-nums">{archived.length}</span>
        </button>
      )}

      {showArchived && (
        <ul className="flex w-full flex-wrap gap-2 border-t border-outline-variant/60 pt-2">
          {archived.map((w) => (
            <li key={w.id}>
              <Link
                href={`/workspaces/${w.id}`}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  w.id === currentId
                    ? 'border-workspace-teal/40 bg-workspace-teal/10 text-workspace-teal'
                    : 'border-outline-variant/60 text-on-surface-variant/70 hover:border-outline hover:text-on-surface'
                }`}
              >
                <span className="max-w-50 truncate">{w.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
