'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Folder, ListTodo, Pencil, Plus, Star, X } from 'lucide-react'
import { useTodos } from '@/lib/daily-goals/use-todos'
import { useTodoLists } from '@/lib/todos/use-todo-lists'
import { groupByParent } from '@/lib/todos/subtasks'
import { londonDayBoundsUTC } from '@/lib/google/london-day'
import { takeMicrosoftConnectResult } from '@/lib/microsoft/connect-errors'
import type { Todo, TodoList } from '@/lib/types'
import { useWorkspaceLookup } from '@/lib/workspaces/use-workspace-lookup'
import ConfirmDialog from '../../ConfirmDialog'
import { changedFields } from '@/lib/todos/patch'
import TodoFormModal, { type TodoFormValues } from './TodoFormModal'
import TodoDetailModal from './TodoDetailModal'
import TodoListFormModal from './TodoListFormModal'
import TodoRow from './TodoRow'
import TodosExtendedView from './TodosExtendedView'
import CompletedTodosList from './CompletedTodosList'
import TodoSyncBar from './TodoSyncBar'
import styles from './TodosBoard.module.css'

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
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

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
    (t: Todo) => (!activeListId || t.list_id === activeListId) && (!starredOnly || t.starred) && (!workspaceId || t.workspace_id === workspaceId) && (!search.trim() || `${t.title} ${t.notes ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())),
    [activeListId, starredOnly, workspaceId, search]
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

  const chooseFilter = (value: string) => {
    setActiveListId(value.startsWith('list:') ? value.slice(5) : null)
    setWorkspaceId(value.startsWith('workspace:') ? value.slice(10) : null)
    setStarredOnly(value === 'starred')
  }
  const filterValue = workspaceId ? `workspace:${workspaceId}` : activeListId ? `list:${activeListId}` : starredOnly ? 'starred' : 'all'
  const workspaceOptions = [...workspaces.values()].filter((workspace) => !workspace.archived)

  return (
    <div className={styles.board}>
      <header className={styles.header}>
        <h1><ListTodo size={22} /> Tasks</h1>
        <label className={styles.search}><span className="sr-only">Search tasks</span><input placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <button className={styles.primary} type="button" onClick={() => setIsAddOpen(true)}><Plus size={16} /> Add task</button>
      </header>
      <div className={styles.sync}><TodoSyncBar status={syncStatus} onSync={syncTodos} connectResult={connectResult} /></div>
      <div className={styles.layout}>
        <nav className={styles.sidebar} aria-label="Task lists and workspaces">
          <h2>Lists</h2>
          <button className={filterValue === 'all' ? styles.active : ''} onClick={() => chooseFilter('all')}><ListTodo size={16} /> All tasks</button>
          <button className={filterValue === 'starred' ? styles.active : ''} onClick={() => chooseFilter('starred')}><Star size={16} /> Starred {starredCount > 0 && `(${starredCount})`}</button>
          {lists.map((list) => <div className={styles.listItem} key={list.id}>
            <button className={filterValue === `list:${list.id}` ? styles.active : ''} onClick={() => chooseFilter(`list:${list.id}`)}><Folder size={16} /> <span>{list.name}</span></button>
            <button aria-label={`Rename ${list.name}`} onClick={() => setEditingList(list)}><Pencil size={14} /></button>
            <button aria-label={`Delete ${list.name}`} onClick={() => setDeletingList(list)}><X size={14} /></button>
          </div>)}
          <button onClick={() => setIsAddListOpen(true)}><Plus size={16} /> New list</button>
          <h2>Workspaces</h2>
          {workspaceOptions.map((workspace) => <button key={workspace.id} className={filterValue === `workspace:${workspace.id}` ? styles.active : ''} onClick={() => chooseFilter(`workspace:${workspace.id}`)}><Folder size={16} /> {workspace.title}</button>)}
        </nav>
        <section className={`${styles.center} ${viewing ? styles.hasDetail : ''}`} aria-label="Tasks">
          <div className={styles.toolbar}>
            <label className={styles.mobilePicker}><span className="sr-only">Choose a list or workspace</span><select value={filterValue} onChange={(e) => chooseFilter(e.target.value)}><option value="all">All tasks</option><option value="starred">Starred</option><optgroup label="Lists">{lists.map((list) => <option key={list.id} value={`list:${list.id}`}>{list.name}</option>)}</optgroup><optgroup label="Workspaces">{workspaceOptions.map((workspace) => <option key={workspace.id} value={`workspace:${workspace.id}`}>{workspace.title}</option>)}</optgroup></select></label>
            <div className={styles.mobileListActions}>
              <button type="button" onClick={() => setIsAddListOpen(true)}>New list</button>
              {activeListId && lists.filter((list) => list.id === activeListId).map((list) => <span key={list.id}><button type="button" onClick={() => setEditingList(list)}>Rename</button><button type="button" onClick={() => setDeletingList(list)}>Delete list</button></span>)}
            </div>
            <div className={styles.modes} aria-label="Task view">{VIEW_MODES.map(({ id, label }) => <button key={id} type="button" aria-pressed={viewMode === id} className={viewMode === id ? styles.active : ''} onClick={() => setViewMode(id)}>{label}</button>)}</div>
          </div>
          <div className={styles.listBody}>
            <h2>{loading ? 'Loading…' : viewMode === 'completed' ? `${completedTodos.length} completed` : `${sorted.length} task${sorted.length === 1 ? '' : 's'}`}</h2>
            {error && <p className="pb-2 text-xs text-academic-orange">{error}</p>}
            {loading ? <p>Loading…</p> : viewMode === 'completed' ? <CompletedTodosList todos={completedTodos} todayDateKey={todayDateKey} workspaces={workspaces} onToggle={handleToggle} onToggleStar={toggleStar} onOpen={setViewingTodo} onEdit={setEditingTodo} onDelete={setDeletingTodo} /> : viewMode === 'extended' ? <TodosExtendedView todos={sorted} todayDateKey={todayDateKey} workspaces={workspaces} onToggle={handleToggle} onToggleStar={toggleStar} onOpen={setViewingTodo} onEdit={setEditingTodo} onDelete={setDeletingTodo} /> : sorted.length === 0 ? <p>No tasks found.</p> : <ul className={styles.rows}>{sorted.map((todo) => <TodoRow key={todo.id} todo={todo} todayDateKey={todayDateKey} subtaskCount={childrenByParent[todo.id]?.length ?? 0} workspace={workspaceFor(todo)} onToggle={() => handleToggle(todo.id)} onToggleStar={() => toggleStar(todo.id)} onOpen={() => setViewingTodo(todo)} onEdit={() => setEditingTodo(todo)} onDelete={() => setDeletingTodo(todo)} />)}</ul>}
          </div>
        </section>
        {viewing && <aside className={styles.detail} aria-label="Task details"><TodoDetailModal
          todo={viewing} todos={todos} lists={lists} workspace={workspaceFor(viewing)} onToggle={handleToggle} onToggleStar={() => toggleStar(viewing.id)}
          onAddSubtask={(title) => addTodo(title, { parent_id: viewing.id, list_id: viewing.list_id })}
          onEdit={() => { setEditingTodo(viewing); setViewingTodo(null) }}
          onDelete={() => { setDeletingTodo(viewing); setViewingTodo(null) }} onClose={() => setViewingTodo(null)}
        /></aside>}
      </div>

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
