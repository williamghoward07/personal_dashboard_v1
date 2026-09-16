'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Link2, ListChecks, Plus, Trash2, Unlink, X } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import type { Todo, WorkspaceLink, WorkspaceLinkTodo } from '@/lib/types'
import AttachExistingTodoPanel from './AttachExistingTodoPanel'
import TodoLinkAttachPanel from './TodoLinkAttachPanel'
import {
  actionButtonClass,
  filterChipActiveClass,
  filterChipClass,
  filterChipInactiveClass,
  ghostButtonClass,
  iconButtonClass,
  inputClass,
  primaryButtonClass,
} from './shared'

type TaskFilter = 'all' | 'linked' | 'done'

export default function TodosSection({
  todos,
  loading,
  addTodo,
  attachTodos,
  detachTodo,
  toggleTodo,
  deleteTodo,
  links,
  linkTodos,
  attachLinksToTodo,
  detachLinkTodo,
}: {
  workspaceId: string
  todos: Todo[]
  loading: boolean
  addTodo: (title: string) => Promise<void>
  attachTodos: (todoIds: string[]) => Promise<void>
  detachTodo: (id: string) => Promise<void>
  toggleTodo: (id: string) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
  links: WorkspaceLink[]
  linkTodos: WorkspaceLinkTodo[]
  attachLinksToTodo: (todoId: string, linkIds: string[]) => Promise<void>
  detachLinkTodo: (junctionId: string) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [attachingExisting, setAttachingExisting] = useState(false)
  const [managingLinksForTodoId, setManagingLinksForTodoId] = useState<string | null>(null)
  const [filter, setFilter] = useState<TaskFilter>('all')

  const linkedTodoIds = useMemo(() => new Set(linkTodos.map((lt) => lt.todo_id)), [linkTodos])
  const doneCount = useMemo(() => todos.filter((t) => t.completed_at).length, [todos])

  const visibleTodos = useMemo(() => {
    if (filter === 'linked') return todos.filter((t) => linkedTodoIds.has(t.id))
    if (filter === 'done') return todos.filter((t) => t.completed_at)
    return todos
  }, [todos, filter, linkedTodoIds])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    await addTodo(trimmed)
    setTitle('')
  }

  return (
    <ModuleGlassCard accent="teal" size="sm" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-on-surface">
          <ListChecks className="h-4 w-4 text-workspace-teal" strokeWidth={1.75} />
          Scoped next actions
          <span className="rounded-full border border-outline-variant px-1.5 py-0.5 text-[11px] tabular-nums text-on-surface-variant">
            {todos.length}
          </span>
        </h2>
        <span className="rounded-full border border-outline-variant px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
          Isolated scope
        </span>
      </div>

      <p className="text-xs leading-relaxed text-on-surface-variant">
        Scoped strictly to this workspace — never mixed into your general todos.
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`${filterChipClass} ${filter === 'all' ? filterChipActiveClass : filterChipInactiveClass}`}
        >
          All ({todos.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('linked')}
          className={`${filterChipClass} ${filter === 'linked' ? filterChipActiveClass : filterChipInactiveClass}`}
        >
          Linked to sources ({linkedTodoIds.size})
        </button>
        <button
          type="button"
          onClick={() => setFilter('done')}
          className={`${filterChipClass} ${filter === 'done' ? filterChipActiveClass : filterChipInactiveClass}`}
        >
          Done ({doneCount})
        </button>
      </div>

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a scoped action..."
          className={`${inputClass} flex-1`}
        />
        <button type="submit" disabled={!title.trim()} className={primaryButtonClass}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add
        </button>
      </form>

      <div>
        <button type="button" onClick={() => setAttachingExisting((v) => !v)} className={actionButtonClass}>
          <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          Attach existing todo
        </button>
        {attachingExisting && (
          <AttachExistingTodoPanel
            onAttach={async (todoIds) => {
              await attachTodos(todoIds)
              setAttachingExisting(false)
            }}
            onClose={() => setAttachingExisting(false)}
          />
        )}
      </div>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading...</p>
      ) : todos.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No scoped actions yet — add one above.</p>
      ) : visibleTodos.length === 0 ? (
        <p className="text-xs text-on-surface-variant">Nothing matches that filter.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleTodos.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              links={links}
              linkTodos={linkTodos}
              toggleTodo={toggleTodo}
              detachTodo={detachTodo}
              deleteTodo={deleteTodo}
              attachLinksToTodo={attachLinksToTodo}
              detachLinkTodo={detachLinkTodo}
              managing={managingLinksForTodoId === todo.id}
              onToggleManaging={() =>
                setManagingLinksForTodoId((current) => (current === todo.id ? null : todo.id))
              }
            />
          ))}
        </ul>
      )}
    </ModuleGlassCard>
  )
}

function TodoRow({
  todo,
  links,
  linkTodos,
  toggleTodo,
  detachTodo,
  deleteTodo,
  attachLinksToTodo,
  detachLinkTodo,
  managing,
  onToggleManaging,
}: {
  todo: Todo
  links: WorkspaceLink[]
  linkTodos: WorkspaceLinkTodo[]
  toggleTodo: (id: string) => Promise<void>
  detachTodo: (id: string) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
  attachLinksToTodo: (todoId: string, linkIds: string[]) => Promise<void>
  detachLinkTodo: (junctionId: string) => Promise<void>
  managing: boolean
  onToggleManaging: () => void
}) {
  const attachedJunctionRows = useMemo(
    () => linkTodos.filter((lt) => lt.todo_id === todo.id),
    [linkTodos, todo.id]
  )
  const attachedLinks = useMemo(
    () =>
      attachedJunctionRows
        .map((row) => links.find((l) => l.id === row.workspace_link_id))
        .filter((l): l is WorkspaceLink => !!l),
    [attachedJunctionRows, links]
  )
  const alreadyAttachedLinkIds = useMemo(() => attachedLinks.map((l) => l.id), [attachedLinks])
  const isDone = !!todo.completed_at

  return (
    <li className="group rounded-xl border border-outline-variant bg-surface-container-low/60 p-3 transition-colors hover:border-workspace-teal/40">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => toggleTodo(todo.id)}
          aria-label={isDone ? `Mark ${todo.title} incomplete` : `Mark ${todo.title} complete`}
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
            isDone
              ? 'border-workspace-teal bg-workspace-teal text-surface-container-lowest'
              : 'border-outline hover:border-workspace-teal'
          }`}
        >
          {isDone && <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className={`text-sm ${isDone ? 'text-on-surface-variant/60 line-through' : 'text-on-surface'}`}>
              {todo.title}
            </span>
            {todo.caldav_uid && (
              <span className="rounded-full border border-outline-variant px-1.5 py-0.5 text-[10px] text-on-surface-variant">
                Reminders
              </span>
            )}
            {todo.due_date && (
              <span className="text-[11px] tabular-nums text-on-surface-variant">
                Due {todo.due_date}
                {todo.due_time ? ` ${todo.due_time}` : ''}
              </span>
            )}
          </div>

          {attachedLinks.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {attachedLinks.map((link) => {
                const junctionRow = attachedJunctionRows.find((row) => row.workspace_link_id === link.id)
                return (
                  <li
                    key={link.id}
                    className="flex items-center gap-1 rounded-md border border-workspace-teal/30 bg-workspace-teal/10 px-2 py-0.5 text-[11px] text-workspace-teal"
                  >
                    <Link2 className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                    <span className="max-w-40 truncate">{link.title}</span>
                    {junctionRow && (
                      <button
                        type="button"
                        onClick={() => detachLinkTodo(junctionRow.id)}
                        aria-label={`Unlink ${link.title}`}
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

          <div className="flex flex-wrap items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" onClick={onToggleManaging} className={`${ghostButtonClass} flex items-center gap-1`}>
              <Link2 className="h-3 w-3" strokeWidth={2} />
              Manage links
            </button>
            <span className="ml-auto flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => detachTodo(todo.id)}
                title="Remove from this workspace (keeps the todo)"
                aria-label={`Remove ${todo.title} from this workspace`}
                className={iconButtonClass}
              >
                <Unlink className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => deleteTodo(todo.id)}
                title="Delete this todo entirely"
                aria-label={`Delete ${todo.title}`}
                className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-error"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </span>
          </div>

          {managing && (
            <TodoLinkAttachPanel
              links={links}
              alreadyAttachedLinkIds={alreadyAttachedLinkIds}
              onAttach={async (linkIds) => {
                await attachLinksToTodo(todo.id, linkIds)
                onToggleManaging()
              }}
              onClose={onToggleManaging}
            />
          )}
        </div>
      </div>
    </li>
  )
}
