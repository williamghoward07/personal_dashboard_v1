'use client'

import { useMemo, useState, type MutableRefObject } from 'react'
import { BookOpen, CheckCircle2, ExternalLink, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Todo, WorkspaceLink, WorkspaceLinkTodo } from '@/lib/types'
import { faviconPublicUrl } from '@/lib/workspaces/favicon'
import { SOURCE_KINDS } from '@/lib/workspaces/kinds'
import type { WorkspaceLinkPatch } from '@/lib/workspaces/use-workspace-links'
import { onActivateKey } from '@/lib/utils/a11y'
import { extractDroppedUrl } from './dnd'
import LinkTodoAttachPanel from './LinkTodoAttachPanel'
import SourceDetailsEditor from './SourceDetailsEditor'
import { ghostButtonClass, iconButtonClass, relativeTime } from './shared'

export default function LinkCard({
  link,
  todos,
  linkTodos,
  onDelete,
  onUpdate,
  onToggleDone,
  onAttachTodos,
  onDetachJunction,
  draggingIdRef,
  onInternalReorder,
  onExternalUrlDrop,
  weekChoices,
  onMarkReading,
}: {
  link: WorkspaceLink
  todos: Todo[]
  linkTodos: WorkspaceLinkTodo[]
  onDelete: (id: string) => void
  onUpdate: (id: string, patch: WorkspaceLinkPatch) => Promise<void>
  onToggleDone: (link: WorkspaceLink) => void
  onAttachTodos: (linkId: string, todoIds: string[]) => Promise<void>
  onDetachJunction: (junctionId: string) => Promise<void>
  // Carries the dragged card's id, not its index — the rendered list can be
  // filtered by kind, so indices don't map onto stored positions.
  draggingIdRef: MutableRefObject<string | null>
  onInternalReorder: (sourceId: string, targetId: string) => void
  onExternalUrlDrop: (url: string) => void
  /** Weeks to offer in the "Week…" control (moves a link into or out of Readings). */
  weekChoices?: number[]
  /** Module workspaces: move this source into the Lectures section's readings. */
  onMarkReading?: () => void
}) {
  const [managingTodos, setManagingTodos] = useState(false)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState<'citation' | 'doi' | null>(null)
  const [isDragTarget, setIsDragTarget] = useState(false)

  // Set optimistically on tick, so a just-finished source greys out in place
  // during its grace period, the same as in the Completed list.
  const done = !!link.completed_at
  const kindMeta = SOURCE_KINDS[link.kind]
  const KindIcon = kindMeta.Icon

  const attachedJunctionRows = useMemo(
    () => linkTodos.filter((lt) => lt.workspace_link_id === link.id),
    [linkTodos, link.id]
  )
  const attachedTodos = useMemo(
    () => attachedJunctionRows.map((row) => todos.find((t) => t.id === row.todo_id)).filter((t): t is Todo => !!t),
    [attachedJunctionRows, todos]
  )
  const alreadyAttachedTodoIds = useMemo(() => attachedTodos.map((t) => t.id), [attachedTodos])

  const domain = useMemo(() => {
    try {
      return new URL(link.url).hostname.replace(/^www\./, '')
    } catch {
      return link.url
    }
  }, [link.url])

  const open = () => window.open(link.url, '_blank', 'noopener,noreferrer')

  const copy = async (field: 'citation' | 'doi', text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(field)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // Clipboard can be blocked by permissions — not worth an error banner
      // for a convenience action.
    }
  }

  return (
    <div
      // Not draggable while an inline editor/panel is open — a draggable
      // ancestor turns a mouse drag inside a text input into a card drag,
      // so text in the rename fields couldn't be selected.
      draggable={!done && !editing && !managingTodos}
      onDragStart={(e) => {
        draggingIdRef.current = link.id
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', link.id)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragTarget(true)
      }}
      onDragLeave={() => setIsDragTarget(false)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragTarget(false)
        const sourceId = draggingIdRef.current
        if (sourceId !== null) {
          onInternalReorder(sourceId, link.id)
        } else {
          const url = extractDroppedUrl(e.dataTransfer)
          if (url) onExternalUrlDrop(url)
        }
        draggingIdRef.current = null
      }}
      onDragEnd={() => {
        draggingIdRef.current = null
        setIsDragTarget(false)
      }}
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={onActivateKey(open)}
      className={`group cursor-pointer rounded-xl border bg-surface-container-low/60 p-3 transition-all duration-200 ${
        isDragTarget
          ? 'border-ws-accent/60 bg-ws-accent/5'
          : done
            ? 'border-outline-variant/50 hover:border-outline-variant'
            : 'border-outline-variant hover:border-ws-accent/40 hover:shadow-[0_0_15px_color-mix(in_oklab,var(--color-ws-accent)_12%,transparent)]'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <GripVertical
          className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-on-surface-variant/30 transition-colors group-hover:text-on-surface-variant/60"
          strokeWidth={1.75}
          aria-hidden
        />

        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Mark ${link.title} not done` : `Mark ${link.title} done`}
          // The card itself opens the URL, so the tick must not bubble.
          onClick={(e) => {
            e.stopPropagation()
            onToggleDone(link)
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className={`mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
            done
              ? 'border-ws-accent bg-ws-accent text-surface-container-lowest'
              : 'border-outline hover:border-ws-accent'
          }`}
        >
          {done && <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} aria-hidden />}
        </button>

        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-opacity ${kindMeta.chipClass} ${
            done ? 'opacity-50' : ''
          }`}
          aria-hidden
        >
          {link.favicon_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={faviconPublicUrl(link.favicon_path)} alt="" width={16} height={16} className="rounded-sm" />
          ) : (
            <KindIcon className="h-4 w-4" strokeWidth={1.75} />
          )}
        </span>

        <div className={`flex min-w-0 flex-1 flex-col gap-1 transition-opacity ${done ? 'opacity-50' : ''}`}>
          <div className="flex items-start gap-2">
            <h3
              className={`min-w-0 flex-1 truncate text-sm font-semibold ${
                done ? 'text-on-surface-variant line-through' : 'text-on-surface'
              }`}
            >
              {link.title}
            </h3>
            <ExternalLink
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-on-surface-variant/40 transition-colors group-hover:text-ws-accent"
              strokeWidth={1.75}
              aria-hidden
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-on-surface-variant">
            <span className="text-ws-accent/80">{domain}</span>
            <span className="text-on-surface-variant/40">·</span>
            <span>{kindMeta.label}</span>
            {link.meta_label && (
              <>
                <span className="text-on-surface-variant/40">·</span>
                <span className="font-mono text-[11px]">{link.meta_label}</span>
              </>
            )}
            <span className="text-on-surface-variant/40">·</span>
            <span className="text-on-surface-variant/70">Added {relativeTime(link.created_at)}</span>
          </div>

          {attachedTodos.length > 0 && (
            <ul className="mt-0.5 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
              {attachedTodos.map((todo) => {
                const junctionRow = attachedJunctionRows.find((row) => row.todo_id === todo.id)
                return (
                  <li
                    key={todo.id}
                    className="flex items-center gap-1 rounded-full border border-ws-accent/30 bg-ws-accent/10 px-2 py-0.5 text-[11px] text-ws-accent"
                  >
                    <span className="max-w-40 truncate">{todo.title}</span>
                    {junctionRow && (
                      <button
                        type="button"
                        onClick={() => onDetachJunction(junctionRow.id)}
                        aria-label={`Detach ${todo.title}`}
                        className="transition-opacity hover:opacity-70"
                      >
                        <X className="h-3 w-3" strokeWidth={2} />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <div
            className="mt-1 flex flex-wrap items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            {link.citation && (
              <button type="button" onClick={() => copy('citation', link.citation!)} className={ghostButtonClass}>
                {copied === 'citation' ? 'Copied' : 'Copy citation'}
              </button>
            )}
            {link.doi && (
              <button type="button" onClick={() => copy('doi', link.doi!)} className={ghostButtonClass}>
                {copied === 'doi' ? 'Copied' : 'Copy DOI'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setManagingTodos((v) => !v)}
              className={`${ghostButtonClass} flex items-center gap-1`}
            >
              <Plus className="h-3 w-3" strokeWidth={2} />
              Task
            </button>

            {weekChoices && (
              <select
                value={link.week ?? ''}
                onChange={(e) => {
                  const week = e.target.value ? Number(e.target.value) : null
                  // Back to a source clears is_reading too — only when the row
                  // has the column (20261019000000 applied), or the update fails.
                  void onUpdate(link.id, week === null && link.is_reading !== undefined ? { week, is_reading: false } : { week })
                }}
                onKeyDown={(e) => e.stopPropagation()}
                aria-label={link.week ? `Reading for week ${link.week}` : 'Move to weekly readings'}
                title={link.week ? 'Change week, or make it a source again' : 'Move to weekly readings'}
                className="rounded-md border border-outline-variant bg-surface-container-lowest px-1.5 py-0.5 text-[11px] text-on-surface-variant outline-none hover:text-on-surface focus:border-ws-accent"
              >
                <option value="">{link.week ? 'Not a reading' : 'Week…'}</option>
                {weekChoices.map((week) => (
                  <option key={week} value={week}>
                    Week {week}
                  </option>
                ))}
              </select>
            )}

            {onMarkReading && (
              <button type="button" onClick={onMarkReading} className={`${ghostButtonClass} flex items-center gap-1`}>
                <BookOpen className="h-3 w-3" strokeWidth={2} />
                Reading
              </button>
            )}

            <span className="ml-auto flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                aria-label="Edit source details"
                className={iconButtonClass}
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(link.id)}
                aria-label={`Delete ${link.title}`}
                className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-error"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </span>
          </div>

          {editing && (
            <div onClick={(e) => e.stopPropagation()}>
              <SourceDetailsEditor
                link={link}
                onSave={(patch) => onUpdate(link.id, patch)}
                onClose={() => setEditing(false)}
              />
            </div>
          )}

          {managingTodos && (
            <div onClick={(e) => e.stopPropagation()}>
              <LinkTodoAttachPanel
                todos={todos}
                alreadyAttachedTodoIds={alreadyAttachedTodoIds}
                onAttach={async (todoIds) => {
                  await onAttachTodos(link.id, todoIds)
                  setManagingTodos(false)
                }}
                onClose={() => setManagingTodos(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
