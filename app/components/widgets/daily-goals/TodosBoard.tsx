'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ListTodo, Pencil, Plus, Star, X } from 'lucide-react'
import { useTodos } from '@/lib/daily-goals/use-todos'
import { useTodoLists } from '@/lib/todos/use-todo-lists'
import { groupByParent } from '@/lib/todos/subtasks'
import { londonDayBoundsUTC } from '@/lib/google/london-day'
import { takeMicrosoftConnectResult } from '@/lib/microsoft/connect-errors'
import type { Todo, TodoList } from '@/lib/types'
import { onActivateKey } from '@/lib/utils/a11y'
import { useWorkspaceLookup } from '@/lib/workspaces/use-workspace-lookup'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { GlassCardHeader, GlassCardContent } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '../../ConfirmDialog'
import { changedFields } from '@/lib/todos/patch'
import TodoFormModal, { type TodoFormValues } from './TodoFormModal'
import TodoDetailModal from './TodoDetailModal'
import TodoListFormModal from './TodoListFormModal'
import TodoRow from './TodoRow'
import TodosExtendedView from './TodosExtendedView'
import CompletedTodosList from './CompletedTodosList'
import TodoSyncBar from './TodoSyncBar'

type ViewMode = 'list' | 'extended' | 'completed'

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'extended', label: 'Extended' },
  { id: 'completed', label: 'Completed' },
]

const RECENTLY_COMPLETED_MS = 5000

// Incomplete first (starred, then overdue, then soonest due, undated
// last), completed last (most recently completed first, so a
// just-finished item doesn't vanish off the bottom of the list
// immediately).
function sortTodos(todos: Todo[], todayDateKey: string): Todo[] {
  return todos.slice().sort((a, b) => {
    const aDone = a.completed_at !== null
    const bDone = b.completed_at !== null
    if (aDone !== bDone) return aDone ? 1 : -1
    if (aDone && bDone) {
      return (b.completed_at ?? '').localeCompare(a.completed_at ?? '')
    }

    if (a.starred !== b.starred) return a.starred ? -1 : 1

    const aOverdue = a.due_date !== null && a.due_date < todayDateKey
    const bOverdue = b.due_date !== null && b.due_date < todayDateKey
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1

    if (a.due_date === null && b.due_date === null) return a.created_at.localeCompare(b.created_at)
    if (a.due_date === null) return 1
    if (b.due_date === null) return -1
    return (
      a.due_date.localeCompare(b.due_date) ||
      (a.due_time ?? '').localeCompare(b.due_time ?? '') ||
      a.created_at.localeCompare(b.created_at)
    )
  })
}

export default function TodosBoard() {
  const todayDateKey = useMemo(() => londonDayBoundsUTC().startDateKey, [])
  const { todos, loading, error, addTodo, toggleTodo, toggleStar, updateTodo, deleteTodo, syncTodos, syncStatus } =
    useTodos(todayDateKey, 'all')
  const { lists, createList, updateList, deleteList } = useTodoLists()
  const workspaces = useWorkspaceLookup()
  const workspaceFor = (todo: Todo) => (todo.workspace_id ? workspaces.get(todo.workspace_id) : undefined)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [deletingTodo, setDeletingTodo] = useState<Todo | null>(null)
  const [viewingTodo, setViewingTodo] = useState<Todo | null>(null)

  const [isAddListOpen, setIsAddListOpen] = useState(false)
  const [editingList, setEditingList] = useState<TodoList | null>(null)
  const [deletingList, setDeletingList] = useState<TodoList | null>(null)
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [starredOnly, setStarredOnly] = useState(false)

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<Set<string>>(new Set())
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [connectResult, setConnectResult] = useState<{ ok: boolean; message: string | null } | null>(null)

  // Pull from Microsoft To Do once per visit to this tab, so tasks added
  // on the phone show up here. syncTodos is stable (useCallback on stable
  // deps), so this genuinely only fires once, not on every render.
  useEffect(() => {
    syncTodos()
  }, [syncTodos])

  // Landing back here from the Microsoft consent screen.
  useEffect(() => {
    const result = takeMicrosoftConnectResult()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL / history API, an external system
    if (result) setConnectResult(result)
  }, [])

  useEffect(() => {
    const timeouts = timeoutsRef.current
    return () => {
      timeouts.forEach((t) => clearTimeout(t))
    }
  }, [])

  const handleToggle = (id: string) => {
    const target = todos.find((t) => t.id === id)
    const isCompleting = target ? target.completed_at === null : false
    toggleTodo(id)

    if (!isCompleting) return

    setRecentlyCompletedIds((prev) => new Set(prev).add(id))
    const existing = timeoutsRef.current.get(id)
    if (existing) clearTimeout(existing)
    timeoutsRef.current.set(
      id,
      setTimeout(() => {
        setRecentlyCompletedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        timeoutsRef.current.delete(id)
      }, RECENTLY_COMPLETED_MS)
    )
  }

  const { topLevel, childrenByParent } = useMemo(() => groupByParent(todos), [todos])

  const matchesFilters = useCallback(
    (t: Todo) => (!activeListId || t.list_id === activeListId) && (!starredOnly || t.starred),
    [activeListId, starredOnly]
  )

  const starredCount = useMemo(() => topLevel.filter((t) => t.starred && t.completed_at === null).length, [topLevel])

  const listFilteredTopLevel = useMemo(() => topLevel.filter(matchesFilters), [topLevel, matchesFilters])

  const visibleIncomplete = useMemo(
    () => listFilteredTopLevel.filter((t) => t.completed_at === null || recentlyCompletedIds.has(t.id)),
    [listFilteredTopLevel, recentlyCompletedIds]
  )

  const sorted = useMemo(() => sortTodos(visibleIncomplete, todayDateKey), [visibleIncomplete, todayDateKey])

  const completedTodos = useMemo(
    () => todos.filter((t) => t.completed_at !== null && matchesFilters(t)),
    [todos, matchesFilters]
  )

  // Keeps the detail modal showing fresh data (e.g. a just-added subtask)
  // instead of the stale snapshot captured when it was opened.
  const viewing = viewingTodo ? (todos.find((t) => t.id === viewingTodo.id) ?? null) : null

  return (
    <div className="flex flex-col gap-6">
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
          <div className="mt-1.5">
            <TodoSyncBar status={syncStatus} onSync={syncTodos} connectResult={connectResult} />
          </div>
        </div>
        <Button type="button" size="sm" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add todo
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setActiveListId(null)}
          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
            activeListId === null
              ? 'border-primary-container/50 bg-primary-container/10 text-primary-container'
              : 'border-outline-variant text-on-surface-variant hover:border-outline'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setStarredOnly((v) => !v)}
          aria-pressed={starredOnly}
          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
            starredOnly
              ? 'border-people-amber/50 bg-people-amber/10 text-people-amber'
              : 'border-outline-variant text-on-surface-variant hover:border-outline'
          }`}
        >
          <Star className="h-3 w-3" fill={starredOnly ? 'currentColor' : 'none'} />
          Starred{starredCount > 0 ? ` (${starredCount})` : ''}
        </button>
        <span className="mx-0.5 h-4 w-px bg-outline-variant" aria-hidden />
        {lists.map((list) => {
          const active = activeListId === list.id
          return (
            <div
              key={list.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveListId(active ? null : list.id)}
              onKeyDown={onActivateKey(() => setActiveListId(active ? null : list.id))}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                active
                  ? 'border-outline bg-surface-container-high text-on-surface'
                  : 'border-outline-variant text-on-surface-variant hover:border-outline'
              }`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: list.color }} />
              {list.name}
              {active && (
                <span className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingList(list)
                    }}
                    aria-label={`Rename ${list.name}`}
                    className="rounded p-0.5 hover:text-on-surface"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeletingList(list)
                    }}
                    aria-label={`Delete ${list.name}`}
                    className="rounded p-0.5 hover:text-error"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => setIsAddListOpen(true)}
          className="flex items-center gap-1 rounded-full border border-dashed border-outline-variant px-2.5 py-1 text-xs text-on-surface-variant hover:border-outline hover:text-on-surface"
        >
          <Plus className="h-3 w-3" />
          New list
        </button>
      </div>

      <ModuleGlassCard accent="neutral">
        <GlassCardHeader>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-sm font-semibold text-foreground">
              {loading
                ? 'Loading…'
                : viewMode === 'completed'
                  ? `${completedTodos.length} completed`
                  : `${sorted.length} todo${sorted.length === 1 ? '' : 's'}`}
            </h2>
            <div className="flex items-center gap-1 rounded-lg bg-surface-container p-0.5">
              {VIEW_MODES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setViewMode(id)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    viewMode === id
                      ? 'bg-surface-container-high text-on-surface'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </GlassCardHeader>
        <GlassCardContent>
          {error && <p className="pb-2 text-xs text-academic-orange">{error}</p>}
          {loading ? (
            <p className="text-sm text-on-surface-variant">Loading…</p>
          ) : viewMode === 'completed' ? (
            <CompletedTodosList
              todos={completedTodos}
              todayDateKey={todayDateKey}
              workspaces={workspaces}
              onToggle={handleToggle}
              onToggleStar={toggleStar}
              onOpen={setViewingTodo}
              onEdit={setEditingTodo}
              onDelete={setDeletingTodo}
            />
          ) : viewMode === 'extended' ? (
            <TodosExtendedView
              todos={sorted}
              todayDateKey={todayDateKey}
              workspaces={workspaces}
              onToggle={handleToggle}
              onToggleStar={toggleStar}
              onOpen={setViewingTodo}
              onEdit={setEditingTodo}
              onDelete={setDeletingTodo}
            />
          ) : sorted.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              {starredOnly
                ? 'No starred todos — star one to keep it on Daily Goals.'
                : 'No todos yet — add one to get started.'}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-outline-variant/40">
              {sorted.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  todayDateKey={todayDateKey}
                  subtaskCount={childrenByParent[todo.id]?.length ?? 0}
                  workspace={workspaceFor(todo)}
                  onToggle={() => handleToggle(todo.id)}
                  onToggleStar={() => toggleStar(todo.id)}
                  onOpen={() => setViewingTodo(todo)}
                  onEdit={() => setEditingTodo(todo)}
                  onDelete={() => setDeletingTodo(todo)}
                />
              ))}
            </ul>
          )}
        </GlassCardContent>
      </ModuleGlassCard>

      <TodoFormModal
        isOpen={isAddOpen}
        heading="New todo"
        onClose={() => setIsAddOpen(false)}
        onSave={(values: TodoFormValues) => {
          addTodo(values.title, {
            due_date: values.due_date,
            due_time: values.due_time,
            notes: values.notes,
            list_id: values.list_id,
            workspace_id: values.workspace_id,
            starred: values.starred,
          })
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
          updateTodo(editingTodo.id, changedFields(editingTodo, values))
          setEditingTodo(null)
        }}
      />

      {viewing && (
        <TodoDetailModal
          todo={viewing}
          todos={todos}
          lists={lists}
          workspace={workspaceFor(viewing)}
          onToggle={handleToggle}
          onToggleStar={() => toggleStar(viewing.id)}
          onAddSubtask={(title) => {
            addTodo(title, { parent_id: viewing.id, list_id: viewing.list_id })
          }}
          onEdit={() => {
            setEditingTodo(viewing)
            setViewingTodo(null)
          }}
          onDelete={() => {
            setDeletingTodo(viewing)
            setViewingTodo(null)
          }}
          onClose={() => setViewingTodo(null)}
        />
      )}

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

      <TodoListFormModal
        isOpen={isAddListOpen}
        heading="New list"
        onClose={() => setIsAddListOpen(false)}
        onSave={(values) => {
          createList(values.name, values.color)
          setIsAddListOpen(false)
        }}
      />

      <TodoListFormModal
        isOpen={editingList !== null}
        heading="Rename list"
        initialValues={editingList}
        onClose={() => setEditingList(null)}
        onSave={(values) => {
          if (!editingList) return
          updateList(editingList.id, values)
          setEditingList(null)
        }}
      />

      <ConfirmDialog
        isOpen={deletingList !== null}
        message={`Delete "${deletingList?.name}"? Todos in this list become unlisted, not deleted.`}
        onCancel={() => setDeletingList(null)}
        onConfirm={() => {
          if (!deletingList) return
          if (activeListId === deletingList.id) setActiveListId(null)
          deleteList(deletingList.id)
          setDeletingList(null)
        }}
      />
    </div>
  )
}
