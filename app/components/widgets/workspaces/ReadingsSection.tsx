'use client'

import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, BookOpen, ChevronDown, Loader2, Plus } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import type { Todo, WorkspaceLink, WorkspaceLinkTodo } from '@/lib/types'
import type { WorkspaceLinkPatch } from '@/lib/workspaces/use-workspace-links'
import { defaultWeek, groupByWeek, readingProgress, weekOptions } from '@/lib/workspaces/readings'
import { findDuplicateUrl } from '@/lib/utils/url'
import LinkCard from './LinkCard'
import { CollapseButton } from './SectionChrome'
import { inputClass, microLabelClass, primaryButtonClass, wsAccentStyle } from './shared'

/** A slim progress bar in the workspace accent. */
export function ReadingBar({ percent, className = 'h-1.5' }: { percent: number; className?: string }) {
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-surface-container-highest ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className="h-full rounded-full bg-ws-accent transition-[width] duration-300" style={{ width: `${percent}%` }} />
    </div>
  )
}

// Weekly readings: links tagged with a week, grouped Week 1, Week 2, …
// with an overall progress bar on top and a count per week. Ticking a
// reading keeps it in its week (greyed), so a week's progress stays
// visible; finished weeks start collapsed. Any source can be moved here
// (and back) with the "Week…" control on its card.
export default function ReadingsSection({
  readings,
  allLinks,
  loading,
  addLink,
  updateLink,
  deleteLink,
  reorderLinks,
  todos,
  linkTodos,
  attachTodosToLink,
  detachLinkTodo,
  onCollapse,
}: {
  readings: WorkspaceLink[]
  /** Every link in the workspace — for the duplicate check. */
  allLinks: WorkspaceLink[]
  loading: boolean
  addLink: (rawUrl: string, options?: { week?: number | null }) => Promise<WorkspaceLink | null>
  updateLink: (id: string, patch: WorkspaceLinkPatch) => Promise<void>
  deleteLink: (id: string) => Promise<void>
  reorderLinks: (orderedIds: string[]) => Promise<void>
  todos: Todo[]
  linkTodos: WorkspaceLinkTodo[]
  attachTodosToLink: (linkId: string, todoIds: string[]) => Promise<void>
  detachLinkTodo: (junctionId: string) => Promise<void>
  onCollapse: () => void
}) {
  const draggingIdRef = useRef<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [week, setWeek] = useState<number | null>(null)
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  // Weeks the user has opened/closed by hand; otherwise finished weeks are closed.
  const [toggledWeeks, setToggledWeeks] = useState<ReadonlySet<number>>(new Set())

  const groups = useMemo(() => groupByWeek(readings), [readings])
  const overall = useMemo(() => readingProgress(readings), [readings])
  const choices = useMemo(() => weekOptions(readings), [readings])
  const latest = groups.at(-1)
  const addWeek = week ?? defaultWeek(readings)
  const duplicate = urlInput.trim() ? findDuplicateUrl(allLinks, urlInput) : null

  const addReading = async (rawUrl: string, targetWeek: number) => {
    if (savingRef.current || !rawUrl.trim()) return
    savingRef.current = true
    setSaving(true)
    try {
      const created = await addLink(rawUrl, { week: targetWeek })
      if (created) setUrlInput('')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const isOpen = (group: (typeof groups)[number]) => {
    const finished = group.progress.total > 0 && group.progress.done === group.progress.total
    return toggledWeeks.has(group.week) ? finished : !finished
  }

  const toggleWeek = (w: number) =>
    setToggledWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(w)) next.delete(w)
      else next.add(w)
      return next
    })

  const toggleDone = (link: WorkspaceLink) =>
    void updateLink(link.id, { completed_at: link.completed_at ? null : new Date().toISOString() })

  return (
    <ModuleGlassCard style={wsAccentStyle} size="sm" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-on-surface">
          <BookOpen className="h-4 w-4 text-ws-accent" strokeWidth={1.75} />
          Weekly readings
          <span className="rounded-full border border-outline-variant px-1.5 py-0.5 text-[11px] tabular-nums text-on-surface-variant">
            {overall.total}
          </span>
        </h2>
        <CollapseButton label="Weekly readings" onClick={onCollapse} />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-on-surface">
            <span className="font-semibold tabular-nums">{overall.done}</span>
            <span className="text-on-surface-variant"> / {overall.total} read</span>
          </span>
          <span className="font-semibold tabular-nums text-ws-accent">{overall.percent}%</span>
        </div>
        <ReadingBar percent={overall.percent} className="h-2" />
        {latest && (
          <span className="text-[11px] text-on-surface-variant">
            Week {latest.week}: {latest.progress.done}/{latest.progress.total} done
          </span>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void addReading(urlInput, addWeek)
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Paste a reading's link or PDF URL…"
          aria-label="Reading URL"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <select
          value={addWeek}
          onChange={(e) => setWeek(Number(e.target.value))}
          aria-label="Week"
          className={`${inputClass} w-24`}
        >
          {choices.map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!urlInput.trim() || saving} aria-busy={saving} className={primaryButtonClass}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" strokeWidth={2} />}
          {saving ? 'Adding…' : duplicate ? 'Add anyway' : 'Add'}
        </button>
        {duplicate && (
          <span className="flex w-full items-center gap-1.5 text-xs text-people-amber">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Already here as &ldquo;{duplicate.title}&rdquo;
            {duplicate.week ? ` (week ${duplicate.week})` : ' (a source)'}
          </span>
        )}
      </form>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading...</p>
      ) : groups.length === 0 ? (
        <p className="text-xs leading-relaxed text-on-surface-variant">
          No readings yet. Add each week&apos;s reading list here, or move an existing source in with its
          &ldquo;Week…&rdquo; control. Tick them off as you go.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const open = isOpen(group)
            const ids = group.links.map((l) => l.id)
            const reorderWithinWeek = (sourceId: string, targetId: string) => {
              if (sourceId === targetId || !ids.includes(sourceId)) return
              const next = ids.filter((id) => id !== sourceId)
              next.splice(next.indexOf(targetId), 0, sourceId)
              void reorderLinks(next)
            }
            return (
              <section key={group.week} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => toggleWeek(group.week)}
                  aria-expanded={open}
                  className="flex items-center gap-2 text-left"
                >
                  <ChevronDown
                    className={`h-3 w-3 shrink-0 text-on-surface-variant transition-transform ${open ? '' : '-rotate-90'}`}
                  />
                  <span className={microLabelClass}>Week {group.week}</span>
                  <span className="text-[11px] tabular-nums text-on-surface-variant">
                    {group.progress.done}/{group.progress.total}
                  </span>
                  <ReadingBar percent={group.progress.percent} className="ml-auto h-1 max-w-24" />
                </button>
                {open &&
                  group.links.map((link) => (
                    <LinkCard
                      key={link.id}
                      link={link}
                      todos={todos}
                      linkTodos={linkTodos}
                      onDelete={deleteLink}
                      onUpdate={updateLink}
                      onToggleDone={toggleDone}
                      onAttachTodos={attachTodosToLink}
                      onDetachJunction={detachLinkTodo}
                      draggingIdRef={draggingIdRef}
                      onInternalReorder={reorderWithinWeek}
                      onExternalUrlDrop={(url) => void addReading(url, group.week)}
                      weekChoices={choices}
                    />
                  ))}
              </section>
            )
          })}
        </div>
      )}
    </ModuleGlassCard>
  )
}
