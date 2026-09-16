'use client'

import { useMemo, useState } from 'react'
import { FolderOpen, Rocket } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import type { Todo, WorkspaceLink, WorkspaceLinkKind, WorkspaceLinkTodo } from '@/lib/types'
import { SOURCE_KINDS, SOURCE_KIND_ORDER } from '@/lib/workspaces/kinds'
import type { WorkspaceLinkPatch } from '@/lib/workspaces/use-workspace-links'
import LinksGrid from './LinksGrid'
import { actionButtonClass, filterChipActiveClass, filterChipClass, filterChipInactiveClass } from './shared'

type KindFilter = WorkspaceLinkKind | 'all'

export default function LinksSection({
  links,
  loading,
  addLink,
  updateLink,
  deleteLink,
  reorderLinks,
  todos,
  linkTodos,
  attachTodosToLink,
  detachLinkTodo,
  addingUrl,
  setAddingUrl,
}: {
  links: WorkspaceLink[]
  loading: boolean
  addLink: (rawUrl: string) => Promise<WorkspaceLink | null>
  updateLink: (id: string, patch: WorkspaceLinkPatch) => Promise<void>
  deleteLink: (id: string) => Promise<void>
  reorderLinks: (orderedIds: string[]) => Promise<void>
  todos: Todo[]
  linkTodos: WorkspaceLinkTodo[]
  attachTodosToLink: (linkId: string, todoIds: string[]) => Promise<void>
  detachLinkTodo: (junctionId: string) => Promise<void>
  addingUrl: boolean
  setAddingUrl: (open: boolean) => void
}) {
  const [filter, setFilter] = useState<KindFilter>('all')

  const counts = useMemo(() => {
    const byKind = {} as Record<WorkspaceLinkKind, number>
    for (const kind of SOURCE_KIND_ORDER) byKind[kind] = links.filter((l) => l.kind === kind).length
    return byKind
  }, [links])

  const visibleLinks = useMemo(
    () => (filter === 'all' ? links : links.filter((l) => l.kind === filter)),
    [links, filter]
  )

  const openAll = () => {
    links.forEach((link) => window.open(link.url, '_blank', 'noopener,noreferrer'))
  }

  return (
    <ModuleGlassCard accent="teal" size="sm" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-on-surface">
          <FolderOpen className="h-4 w-4 text-workspace-teal" strokeWidth={1.75} />
          Scoped sources
          <span className="rounded-full border border-outline-variant px-1.5 py-0.5 text-[11px] tabular-nums text-on-surface-variant">
            {links.length}
          </span>
        </h2>

        <button type="button" onClick={openAll} disabled={links.length === 0} className={actionButtonClass}>
          <Rocket className="h-3.5 w-3.5" strokeWidth={1.75} />
          Launch set
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`${filterChipClass} ${filter === 'all' ? filterChipActiveClass : filterChipInactiveClass}`}
        >
          All ({links.length})
        </button>
        {SOURCE_KIND_ORDER.filter((kind) => counts[kind] > 0).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setFilter(kind)}
            className={`${filterChipClass} flex items-center gap-1.5 ${
              filter === kind ? filterChipActiveClass : filterChipInactiveClass
            }`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${SOURCE_KINDS[kind].dotClass}`} aria-hidden />
            {SOURCE_KINDS[kind].label}s ({counts[kind]})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading...</p>
      ) : (
        <>
          <LinksGrid
            links={visibleLinks}
            allLinks={links}
            addLink={addLink}
            updateLink={updateLink}
            deleteLink={deleteLink}
            reorderLinks={reorderLinks}
            todos={todos}
            linkTodos={linkTodos}
            attachTodosToLink={attachTodosToLink}
            detachLinkTodo={detachLinkTodo}
            addingUrl={addingUrl}
            setAddingUrl={setAddingUrl}
          />
          {links.length > 0 && visibleLinks.length === 0 && (
            <p className="text-xs text-on-surface-variant">No sources of that type.</p>
          )}
        </>
      )}
    </ModuleGlassCard>
  )
}
