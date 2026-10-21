'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { CountBadge } from '@/components/ui/count-badge'
import type { Todo, WorkspaceLink, WorkspaceLinkKind, WorkspaceLinkTodo } from '@/lib/types'
import { RECENTLY_COMPLETED_MS, partitionLinks } from '@/lib/workspaces/completed'
import { SOURCE_KINDS, SOURCE_KIND_ORDER } from '@/lib/workspaces/kinds'
import type { WorkspaceLinkPatch } from '@/lib/workspaces/use-workspace-links'
import LinksGrid from './LinksGrid'
import { CollapseButton } from './SectionChrome'
import { filterChipActiveClass, filterChipClass, filterChipInactiveClass, wsAccentStyle } from './shared'

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
  weekChoices,
  markReading,
  onCollapse,
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
  /** Set while Readings is shown: cards can be moved into a week. */
  weekChoices?: number[]
  /** Module workspaces: cards can be moved into the Lectures section. */
  markReading?: (link: WorkspaceLink) => void
  onCollapse: () => void
}) {
  const [filter, setFilter] = useState<KindFilter>('all')

  // Sources ticked in the last few seconds stay in the main list (greyed)
  // before dropping into Completed, so a mis-click is easy to spot and undo.
  const [recentIds, setRecentIds] = useState<ReadonlySet<string>>(new Set())
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const timeouts = timeoutsRef.current
    return () => timeouts.forEach((t) => clearTimeout(t))
  }, [])

  const forgetRecent = useCallback((id: string) => {
    const pending = timeoutsRef.current.get(id)
    if (pending) clearTimeout(pending)
    timeoutsRef.current.delete(id)
    setRecentIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const toggleDone = useCallback(
    (link: WorkspaceLink) => {
      if (link.completed_at) {
        forgetRecent(link.id)
        void updateLink(link.id, { completed_at: null })
        return
      }
      void updateLink(link.id, { completed_at: new Date().toISOString() })
      const pending = timeoutsRef.current.get(link.id)
      if (pending) clearTimeout(pending)
      setRecentIds((prev) => new Set(prev).add(link.id))
      timeoutsRef.current.set(
        link.id,
        setTimeout(() => forgetRecent(link.id), RECENTLY_COMPLETED_MS)
      )
    },
    [updateLink, forgetRecent]
  )

  const { open, completed } = useMemo(() => partitionLinks(links, recentIds), [links, recentIds])

  const counts = useMemo(() => {
    const byKind = {} as Record<WorkspaceLinkKind, number>
    for (const kind of SOURCE_KIND_ORDER) byKind[kind] = open.filter((l) => l.kind === kind).length
    return byKind
  }, [open])

  const visibleLinks = useMemo(
    () => (filter === 'all' ? open : open.filter((l) => l.kind === filter)),
    [open, filter]
  )

  return (
    <ModuleGlassCard style={wsAccentStyle} size="sm" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-on-surface">
          <FolderOpen className="h-4 w-4 text-ws-accent" strokeWidth={1.75} />
          Scoped sources
          <CountBadge accent="ws" count={open.length} />
        </h2>
        <CollapseButton label="Scoped sources" onClick={onCollapse} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`${filterChipClass} ${filter === 'all' ? filterChipActiveClass : filterChipInactiveClass}`}
        >
          All ({open.length})
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
            completedLinks={completed}
            allLinks={links}
            addLink={addLink}
            updateLink={updateLink}
            toggleDone={toggleDone}
            deleteLink={deleteLink}
            reorderLinks={reorderLinks}
            todos={todos}
            linkTodos={linkTodos}
            attachTodosToLink={attachTodosToLink}
            detachLinkTodo={detachLinkTodo}
            addingUrl={addingUrl}
            setAddingUrl={setAddingUrl}
            weekChoices={weekChoices}
            markReading={markReading}
          />
          {open.length > 0 && visibleLinks.length === 0 && (
            <p className="text-xs text-on-surface-variant">No sources of that type.</p>
          )}
        </>
      )}
    </ModuleGlassCard>
  )
}
