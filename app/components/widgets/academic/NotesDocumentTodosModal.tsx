'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Todo } from '@/lib/types'
import Modal from '../../Modal'

export default function NotesDocumentTodosModal({
  pageTitle,
  todos,
  onAddTodo,
  onToggleTodo,
  onUnlinkTodo,
  onClose,
}: {
  pageTitle: string
  todos: Todo[]
  onAddTodo: (title: string) => void
  onToggleTodo: (todoId: string) => void
  onUnlinkTodo: (todoId: string) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState('')
  const completed = todos.filter((t) => t.completed_at !== null).length

  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="truncate font-display text-sm font-semibold text-on-surface">{pageTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {todos.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className="h-full rounded-full bg-academic-orange transition-all"
                style={{ width: `${(completed / todos.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-on-surface-variant">
              {completed}/{todos.length} complete
            </span>
          </div>
        )}

        {todos.length === 0 ? (
          <p className="text-xs text-on-surface-variant">No todos attached yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {todos.map((todo) => {
              const done = todo.completed_at !== null
              const inputId = `notes-doc-todo-${todo.id}`
              return (
                <li key={todo.id} className="flex items-center gap-2">
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={done}
                    onChange={() => onToggleTodo(todo.id)}
                    className="h-3.5 w-3.5 shrink-0 cursor-pointer appearance-none rounded border border-outline-variant bg-transparent checked:border-primary-container checked:bg-primary-container"
                  />
                  <label
                    htmlFor={inputId}
                    className={`flex-1 cursor-pointer truncate text-sm ${
                      done ? 'text-on-surface-variant line-through' : 'text-on-surface'
                    }`}
                  >
                    {todo.title}
                  </label>
                  <button
                    type="button"
                    onClick={() => onUnlinkTodo(todo.id)}
                    aria-label={`Unlink ${todo.title}`}
                    className="shrink-0 rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            const trimmed = draft.trim()
            if (!trimmed) return
            onAddTodo(trimmed)
            setDraft('')
          }}
          className="flex items-center gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a todo for this page"
            className="flex-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-academic-orange"
          />
          <button
            type="submit"
            aria-label="Add todo"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>
      </div>
    </Modal>
  )
}
