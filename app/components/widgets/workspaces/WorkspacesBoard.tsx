'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore, FolderKanban, Plus } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import type { Workspace } from '@/lib/types'
import { useWorkspaces } from '@/lib/workspaces/use-workspaces'
import WorkspaceHeaderStrip from './WorkspaceHeaderStrip'
import { actionButtonClass, formatDate, inputClass, microLabelClass, primaryButtonClass } from './shared'

export default function WorkspacesBoard() {
  const router = useRouter()
  const { workspaces, loading, error, createWorkspace, archiveWorkspace, unarchiveWorkspace } = useWorkspaces()
  const [title, setTitle] = useState('')

  const active = useMemo(() => workspaces.filter((w) => !w.archived_at), [workspaces])
  const archived = useMemo(() => workspaces.filter((w) => w.archived_at), [workspaces])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    const created = await createWorkspace(trimmed)
    setTitle('')
    if (created) router.push(`/workspaces/${created.id}`)
  }

  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      <WorkspaceHeaderStrip context="All Contexts" />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-headline-lg font-bold text-workspace-teal">Workspaces</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            An ad hoc container per project — its sources, its scoped actions, and a dated log of your thinking.
          </p>
        </div>

        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Coastal Erosion Essay"
            className={`${inputClass} w-64`}
          />
          <button type="submit" disabled={!title.trim()} className={primaryButtonClass}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            New workspace
          </button>
        </form>
      </div>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading...</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className={microLabelClass}>Active ({active.length})</h2>
            {active.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                No active workspaces yet — create one to get started.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {active.map((w) => (
                  <WorkspaceCard key={w.id} workspace={w} onArchive={() => archiveWorkspace(w.id)} />
                ))}
              </ul>
            )}
          </section>

          {archived.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className={microLabelClass}>Archived ({archived.length})</h2>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {archived.map((w) => (
                  <WorkspaceCard key={w.id} workspace={w} onUnarchive={() => unarchiveWorkspace(w.id)} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  )
}

function WorkspaceCard({
  workspace,
  onArchive,
  onUnarchive,
}: {
  workspace: Workspace
  onArchive?: () => void
  onUnarchive?: () => void
}) {
  const isArchived = !!workspace.archived_at

  return (
    <li>
      <ModuleGlassCard accent="teal" size="sm" className="flex h-full flex-col gap-2">
        <Link href={`/workspaces/${workspace.id}`} className="flex min-w-0 items-start gap-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
              isArchived
                ? 'border-outline-variant bg-surface-container-highest text-on-surface-variant'
                : 'border-workspace-teal/30 bg-workspace-teal/10 text-workspace-teal'
            }`}
            aria-hidden
          >
            <FolderKanban className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-on-surface">{workspace.title}</span>
            <span className="truncate text-xs text-on-surface-variant">
              {workspace.subtitle || `Created ${formatDate(workspace.created_at)}`}
            </span>
          </span>
        </Link>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              isArchived
                ? 'border-outline-variant bg-surface-container-highest text-on-surface-variant'
                : 'border-workspace-teal/30 bg-workspace-teal/10 text-workspace-teal'
            }`}
          >
            {isArchived ? 'Archived' : 'Active'}
          </span>

          {isArchived ? (
            <button type="button" onClick={onUnarchive} className={actionButtonClass}>
              <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={1.75} />
              Unarchive
            </button>
          ) : (
            <button type="button" onClick={onArchive} className={actionButtonClass}>
              <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
              Archive
            </button>
          )}
        </div>
      </ModuleGlassCard>
    </li>
  )
}
