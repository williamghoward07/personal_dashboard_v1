'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, Loader2, Plus } from 'lucide-react'
import type { Todo, WorkspaceLink, WorkspaceLinkTodo } from '@/lib/types'
import type { WorkspaceLinkPatch } from '@/lib/workspaces/use-workspace-links'
import { findDuplicateUrl } from '@/lib/utils/url'
import { extractDroppedUrl } from './dnd'
import LinkCard from './LinkCard'
import { ghostButtonClass, inputClass, microLabelClass, primaryButtonClass } from './shared'

export default function LinksGrid({
  links,
  completedLinks,
  allLinks,
  addLink,
  updateLink,
  toggleDone,
  deleteLink,
  reorderLinks,
  todos,
  linkTodos,
  attachTodosToLink,
  detachLinkTodo,
  addingUrl,
  setAddingUrl,
  weekChoices,
}: {
  /** The rendered (possibly kind-filtered) list. */
  links: WorkspaceLink[]
  /** Finished sources, shown in a collapsed sublist below the rest. */
  completedLinks: WorkspaceLink[]
  /** The full ordered list — reordering must be computed against this. */
  allLinks: WorkspaceLink[]
  addLink: (rawUrl: string) => Promise<WorkspaceLink | null>
  updateLink: (id: string, patch: WorkspaceLinkPatch) => Promise<void>
  toggleDone: (link: WorkspaceLink) => void
  deleteLink: (id: string) => Promise<void>
  reorderLinks: (orderedIds: string[]) => Promise<void>
  todos: Todo[]
  linkTodos: WorkspaceLinkTodo[]
  attachTodosToLink: (linkId: string, todoIds: string[]) => Promise<void>
  detachLinkTodo: (junctionId: string) => Promise<void>
  addingUrl: boolean
  setAddingUrl: (open: boolean) => void
  /** When set, each card offers "Week…" to move it into Readings. */
  weekChoices?: number[]
}) {
  // Primary DnD-disambiguation signal — checked before ever inspecting a
  // drop event's DataTransfer, since dragstart must call setData for the
  // drag to be permitted at all, so DataTransfer alone can't distinguish
  // an internal card drag from an external URL drag. See dnd.ts.
  const draggingIdRef = useRef<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [isDropTarget, setIsDropTarget] = useState(false)
  // Collapsed by default — finished sources are out of the way but recoverable.
  const [completedOpen, setCompletedOpen] = useState(false)

  // Ref, not just state: a fast double Enter fires twice before a re-render.
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)

  const handleAddUrl = async (rawUrl: string) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      const result = await addLink(rawUrl)
      if (result) {
        setUrlInput('')
        setAddingUrl(false)
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const duplicate = urlInput.trim() ? findDuplicateUrl(allLinks, urlInput) : null

  // Resolved against allLinks, never the rendered list, so dropping onto a
  // card still writes correct positions while a kind filter is active.
  const handleInternalReorder = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    const sourceIndex = allLinks.findIndex((l) => l.id === sourceId)
    const targetIndex = allLinks.findIndex((l) => l.id === targetId)
    if (sourceIndex === -1 || targetIndex === -1) return

    const reordered = [...allLinks]
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    reorderLinks(reordered.map((l) => l.id))
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (draggingIdRef.current === null) setIsDropTarget(true)
      }}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDropTarget(false)
        // An internal reorder already handled itself via a card's onDrop
        // (which stops propagation), or the drag ended outside any card —
        // either way this container must not also try to add a URL.
        if (draggingIdRef.current !== null) return
        const url = extractDroppedUrl(e.dataTransfer)
        if (url) handleAddUrl(url)
      }}
      className={`flex flex-col gap-2 rounded-xl transition-colors ${
        isDropTarget ? 'bg-ws-accent/5 outline-2 outline-dashed outline-ws-accent/40' : ''
      }`}
    >
      {links.map((link) => (
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
          onInternalReorder={handleInternalReorder}
          onExternalUrlDrop={handleAddUrl}
          weekChoices={weekChoices}
        />
      ))}

      {addingUrl ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (urlInput.trim()) handleAddUrl(urlInput)
          }}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-ws-accent/40 bg-surface-container-low/40 p-2.5"
        >
          <input
            autoFocus
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setAddingUrl(false)
            }}
            placeholder="https://example.com"
            className={`${inputClass} flex-1`}
          />
          <button
            type="submit"
            disabled={!urlInput.trim() || saving}
            aria-busy={saving}
            className={`${primaryButtonClass} flex items-center gap-1.5`}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? 'Adding…' : duplicate ? 'Add anyway' : 'Add'}
          </button>
          <button type="button" onClick={() => setAddingUrl(false)} className={ghostButtonClass}>
            Cancel
          </button>
          {duplicate && (
            <span className="flex w-full items-center gap-1.5 text-xs text-people-amber">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Already here as &ldquo;{duplicate.title}&rdquo;
              {duplicate.completed_at ? ' (completed)' : ''}
            </span>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAddingUrl(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-outline-variant px-3 py-2.5 text-xs text-on-surface-variant transition-colors hover:border-ws-accent/50 hover:text-ws-accent"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add a source, or drop a link here
        </button>
      )}

      {completedLinks.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={() => setCompletedOpen((v) => !v)}
            aria-expanded={completedOpen}
            className={`${microLabelClass} flex w-fit items-center gap-1 transition-colors hover:text-on-surface`}
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${completedOpen ? '' : '-rotate-90'}`} />
            Completed ({completedLinks.length})
          </button>
          {completedOpen &&
            completedLinks.map((link) => (
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
                onInternalReorder={handleInternalReorder}
                onExternalUrlDrop={handleAddUrl}
              />
            ))}
        </div>
      )}
    </div>
  )
}
