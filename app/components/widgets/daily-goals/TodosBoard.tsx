'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ListTodo, Plus, Pencil, Trash2 } from 'lucide-react'
import { useTodos } from '@/lib/daily-goals/use-todos'
import { londonDayBoundsUTC } from '@/lib/google/london-day'
import type { Todo } from '@/lib/types'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { GlassCardHeader, GlassCardContent } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '../../ConfirmDialog'
import TodoFormModal, { type TodoFormValues } from './TodoFormModal'

// Incomplete first (overdue, then soonest due, undated last), completed
// last (most recently completed first, so a just-finished item doesn't
// vanish off the bottom of the list immediately).
function sortTodos(todos: Todo[], todayDateKey: string): Todo[] {
  return todos.slice().sort((a, b) => {
    const aDone = a.completed_at !== null
    const bDone = b.completed_at !== null
    if (aDone !== bDone) return aDone ? 1 : -1
    if (aDone && bDone) {
      return (b.completed_at ?? '').localeCompare(a.completed_at ?? '')
    }

    const aOverdue = a.due_date !== null && a.due_date < todayDateKey
    const bOverdue = b.due_date !== null && b.due_date < todayDateKey
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1

    if (a.due_date === null && b.due_date === null) return a.created_at.localeCompare(b.created_at)
    if (a.due_date === null) return 1
    if (b.due_date === null) return -1
    return a.due_date.localeCompare(b.due_date) || a.created_at.localeCompare(b.created_at)
  })
}

export default function TodosBoard() {
  const todayDateKey = useMemo(() => londonDayBoundsUTC().startDateKey, [])
  const { todos, loading, error, addTodo, toggleTodo, updateTodo, deleteTodo } = useTodos(
    todayDateKey,
    'all'
  )

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [deletingTodo, setDeletingTodo] = useState<Todo | null>(null)

  const sorted = useMemo(() => sortTodos(todos, todayDateKey), [todos, todayDateKey])

  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-headline-lg font-bold text-on-surface">
            <ListTodo className="h-6 w-6" />
            Todos
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Every to-do, not just today&apos;s.{' '}
            <Link href="/" className="underline hover:text-on-surface">
              Back to Daily Goals
            </Link>
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add todo
        </Button>
      </div>

      <ModuleGlassCard accent="neutral">
        <GlassCardHeader>
          <h2 className="font-display text-sm font-semibold text-foreground">
            {loading ? 'Loading…' : `${sorted.length} todo${sorted.length === 1 ? '' : 's'}`}
          </h2>
        </GlassCardHeader>
        <GlassCardContent>
          {error && <p className="pb-2 text-xs text-academic-orange">{error}</p>}
          {loading ? (
            <p className="text-sm text-on-surface-variant">Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No todos yet — add one to get started.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-outline-variant/40">
              {sorted.map((todo) => {
                const completed = todo.completed_at !== null
                const overdue = !completed && todo.due_date !== null && todo.due_date < todayDateKey
                const inputId = `todos-page-${todo.id}`
                return (
                  <li key={todo.id} className="flex items-center gap-3 py-2.5">
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={completed}
                      onChange={() => toggleTodo(todo.id)}
                      className="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-outline-variant bg-transparent checked:border-primary-container checked:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50"
                    />
                    <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                      <span
                        className={`block truncate text-sm ${
                          completed ? 'text-on-surface-variant line-through' : 'text-on-surface'
                        }`}
                      >
                        {todo.title}
                      </span>
                      {todo.notes && (
                        <span className="block truncate text-xs text-on-surface-variant">
                          {todo.notes}
                        </span>
                      )}
                    </label>
                    {todo.due_date && (
                      <span
                        className={`shrink-0 text-xs font-medium ${
                          overdue ? 'text-academic-orange' : 'text-on-surface-variant'
                        }`}
                      >
                        {overdue ? 'Overdue · ' : ''}
                        {todo.due_date}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingTodo(todo)}
                      aria-label={`Edit ${todo.title}`}
                      className="shrink-0 rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingTodo(todo)}
                      aria-label={`Delete ${todo.title}`}
                      className="shrink-0 rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </GlassCardContent>
      </ModuleGlassCard>

      <TodoFormModal
        isOpen={isAddOpen}
        heading="New todo"
        onClose={() => setIsAddOpen(false)}
        onSave={(values: TodoFormValues) => {
          addTodo(values.title, { due_date: values.due_date, notes: values.notes })
          setIsAddOpen(false)
        }}
      />

      <TodoFormModal
        isOpen={editingTodo !== null}
        heading="Edit todo"
        initialValues={editingTodo}
        onClose={() => setEditingTodo(null)}
        onSave={(values: TodoFormValues) => {
          if (!editingTodo) return
          updateTodo(editingTodo.id, values)
          setEditingTodo(null)
        }}
      />

      <ConfirmDialog
        isOpen={deletingTodo !== null}
        message={`Delete "${deletingTodo?.title}"? This can't be undone.`}
        onCancel={() => setDeletingTodo(null)}
        onConfirm={() => {
          if (!deletingTodo) return
          deleteTodo(deletingTodo.id)
          setDeletingTodo(null)
        }}
      />
    </main>
  )
}
