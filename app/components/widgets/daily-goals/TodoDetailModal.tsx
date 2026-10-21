'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Link2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Todo, TodoList } from '@/lib/types'
import type { WorkspaceTag } from '@/lib/workspaces/use-workspace-lookup'
import { groupByParent } from '@/lib/todos/subtasks'
import { formatDue } from '@/lib/todos/format'
import { isSyncedTodo } from '@/lib/todos/patch'
import { londonDayBoundsUTC } from '@/lib/google/london-day'
import Modal from '../../Modal'
import WorkspaceChip from '../workspaces/WorkspaceChip'
import StarButton from './StarButton'

interface LinkedSource {
  id: string
  title: string
  workspace_id: string
}

// Workspace sources this todo is attached to (workspace_link_todos) —
// may span workspaces other than the todo's own.
function useLinkedSources(todoId: string): LinkedSource[] {
  const [sources, setSources] = useState<LinkedSource[]>([])
  useEffect(() => {
    let cancelled = false
    supabase
      .from('workspace_link_todos')
      .select('link:workspace_links(id, title, workspace_id)')
      .eq('todo_id', todoId)
      .then(({ data }) => {
        if (cancelled) return
        const rows = (data ?? []) as unknown as { link: LinkedSource | null }[]
        setSources(rows.map((r) => r.link).filter((l): l is LinkedSource => l !== null))
      })
    return () => {
      cancelled = true
    }
  }, [todoId])
  return sources
}

export default function TodoDetailModal({
  todo,
  todos,
  lists,
  workspace,
  onToggle,
  onToggleStar,
  onAddSubtask,
  onEdit,
  onDelete,
  onClose,
}: {
  todo: Todo
  todos: Todo[]
  lists: TodoList[]
  workspace?: WorkspaceTag
  onToggle: (id: string) => void
  onToggleStar: () => void
  onAddSubtask: (title: string) => void
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const [newSubtask, setNewSubtask] = useState('')
  const { childrenByParent } = groupByParent(todos)
  const subtasks = childrenByParent[todo.id] ?? []
  const list = lists.find((l) => l.id === todo.list_id) ?? null
  // Matches the DB guard trigger: only a top-level todo can gain subtasks
  // (no grandchildren). They sync to To Do as the task's steps.
  const canAddSubtasks = todo.parent_id === null
  const due = formatDue(todo, londonDayBoundsUTC().startDateKey)
  const linkedSources = useLinkedSources(todo.id)

  return (
    <Modal onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-base font-bold text-on-surface">{todo.title}</h2>
          <div className="flex shrink-0 items-center">
            <StarButton starred={todo.starred} title={todo.title} onToggle={onToggleStar} alwaysShow />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
          {due && <span className={due.overdue ? 'text-academic-orange' : undefined}>Due: {due.label}</span>}
          {list && <span>List: {list.name}</span>}
          {isSyncedTodo(todo) && <span>Synced with Microsoft To Do</span>}
          {workspace && (
            <span className="flex items-center gap-1.5">
              Workspace: <WorkspaceChip workspace={workspace} />
            </span>
          )}
        </div>

        {linkedSources.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold text-on-surface-variant">Linked sources</h3>
            <ul className="flex flex-wrap gap-1.5">
              {linkedSources.map((source) => (
                <li key={source.id}>
                  <Link
                    href={`/workspaces/${source.workspace_id}`}
                    className="flex items-center gap-1 rounded-md border border-outline-variant px-2 py-0.5 text-[11px] text-on-surface-variant hover:border-outline hover:text-on-surface"
                  >
                    <Link2 className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="max-w-48 truncate">{source.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {todo.notes && (
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold text-on-surface-variant">Notes</h3>
            <p className="text-sm text-on-surface">{todo.notes}</p>
          </div>
        )}

        {(subtasks.length > 0 || canAddSubtasks) && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-on-surface-variant">Subtasks</h3>

            {subtasks.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {subtasks.map((subtask) => {
                  const completed = subtask.completed_at !== null
                  const inputId = `subtask-${subtask.id}`
                  return (
                    <li key={subtask.id} className="flex items-center gap-2">
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={completed}
                        onChange={() => onToggle(subtask.id)}
                        className="h-3.5 w-3.5 shrink-0 cursor-pointer appearance-none rounded border border-outline-variant bg-transparent checked:border-primary-container checked:bg-primary-container"
                      />
                      <label
                        htmlFor={inputId}
                        className={`flex-1 cursor-pointer text-sm ${
                          completed ? 'text-on-surface-variant line-through' : 'text-on-surface'
                        }`}
                      >
                        {subtask.title}
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}

            {canAddSubtasks && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const trimmed = newSubtask.trim()
                  if (!trimmed) return
                  onAddSubtask(trimmed)
                  setNewSubtask('')
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  placeholder="Add a subtask"
                  className="flex-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary-container"
                />
                <button
                  type="submit"
                  aria-label="Add subtask"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-error"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    </Modal>
  )
}
