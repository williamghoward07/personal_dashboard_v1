'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Todo, TodoList } from '@/lib/types'
import { groupByParent } from '@/lib/todos/subtasks'
import Modal from '../../Modal'

export default function TodoDetailModal({
  todo,
  todos,
  lists,
  onToggle,
  onAddSubtask,
  onEdit,
  onDelete,
  onClose,
}: {
  todo: Todo
  todos: Todo[]
  lists: TodoList[]
  onToggle: (id: string) => void
  onAddSubtask: (title: string) => void
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const [newSubtask, setNewSubtask] = useState('')
  const { childrenByParent } = groupByParent(todos)
  const subtasks = childrenByParent[todo.id] ?? []
  const list = lists.find((l) => l.id === todo.list_id) ?? null
  // Matches the DB guard trigger: only a top-level, non-CalDAV todo can
  // gain subtasks (no grandchildren, no CalDAV-linked parents).
  const canAddSubtasks = todo.parent_id === null && !todo.caldav_uid

  return (
    <Modal onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-base font-bold text-on-surface">{todo.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
          {todo.due_date && (
            <span>
              Due: {todo.due_date}
              {todo.due_time ? ` · ${todo.due_time}` : ''}
            </span>
          )}
          {list && <span>List: {list.name}</span>}
        </div>

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
