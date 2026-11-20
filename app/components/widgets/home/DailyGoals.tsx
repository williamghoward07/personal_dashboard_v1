'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Pencil, Target, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { DailyGoalHabit, DailyGoalHabitCompletion, EducationTask, FollowUp } from '@/lib/types'
import { londonDayBoundsUTC, londonWeekBoundsUTC } from '@/lib/google/london-day'
import { computeHabitSchedule, computeDailyGoalsRollup } from '@/lib/daily-goals/rollup'
import { capChecklist, selectChecklistTodos } from '@/lib/daily-goals/checklist'
import { useTodos } from '@/lib/daily-goals/use-todos'
import { HOME_PULL_INTERVAL_MS, TODO_CONNECT_HREF, pullIsDue } from '@/lib/todos/sync-client'
import { formatDue } from '@/lib/todos/format'
import { changedFields } from '@/lib/todos/patch'
import { useHabitsVersion } from '@/lib/habits/events'
import { useWorkspaceLookup } from '@/lib/workspaces/use-workspace-lookup'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { GlassCardHeader, GlassCardContent } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import StarButton from '../daily-goals/StarButton'
import WorkspaceChip from '../workspaces/WorkspaceChip'
import TodoFormModal from '../daily-goals/TodoFormModal'
import type { Todo } from '@/lib/types'

interface DomainData {
  educationTasksDueToday: EducationTask[]
  followUpsDueToday: FollowUp[]
  habits: DailyGoalHabit[]
  completionsThisWeek: DailyGoalHabitCompletion[]
}

export default function DailyGoals() {
  const { todayDateKey, weekStartKey, weekEndKeyExclusive } = useMemo(() => {
    const day = londonDayBoundsUTC()
    const week = londonWeekBoundsUTC()
    return { todayDateKey: day.startDateKey, weekStartKey: week.startDateKey, weekEndKeyExclusive: week.endDateKey }
  }, [])

  const {
    todos,
    loading: todosLoading,
    error: todosError,
    addTodo,
    toggleTodo,
    toggleStar,
    updateTodo,
    syncTodos,
    syncStatus,
  } = useTodos(todayDateKey)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const workspaces = useWorkspaceLookup()
  const habitsVersion = useHabitsVersion()

  const [domain, setDomain] = useState<DomainData | null>(null)
  const [domainLoading, setDomainLoading] = useState(true)
  const [domainError, setDomainError] = useState<string | null>(null)
  const [newTodoText, setNewTodoText] = useState('')
  const [adding, setAdding] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  // Ticked or added during this visit — these stay in place past the cap.
  const [keepIds, setKeepIds] = useState<ReadonlySet<string>>(new Set())
  const keep = (id: string) => setKeepIds((prev) => new Set(prev).add(id))

  // Pick up tasks added on the phone, at most every few minutes.
  useEffect(() => {
    if (pullIsDue(HOME_PULL_INTERVAL_MS)) syncTodos()
  }, [syncTodos])

  useEffect(() => {
    // No setDomainLoading(true) here: `domainLoading` already starts
    // true, and todayDateKey/weekStartKey/weekEndKeyExclusive never
    // change within a session (see the useMemo above), so this effect
    // only ever runs once — calling setState synchronously at the top of
    // an effect body is flagged by react-hooks/set-state-in-effect.
    let cancelled = false

    Promise.all([
      supabase.from('education_tasks').select('*').eq('due_date', todayDateKey),
      supabase.from('follow_ups').select('*').eq('due_date', todayDateKey),
      supabase.from('daily_goal_habits').select('*').eq('is_active', true),
      supabase
        .from('daily_goal_habit_completions')
        .select('*')
        .gte('completed_on', weekStartKey)
        .lt('completed_on', weekEndKeyExclusive),
    ]).then(([educationRes, followUpsRes, habitsRes, completionsRes]) => {
      if (cancelled) return

      const firstError = educationRes.error ?? followUpsRes.error ?? habitsRes.error ?? completionsRes.error
      if (firstError) {
        setDomainError(firstError.message)
        setDomainLoading(false)
        return
      }

      setDomainError(null)
      setDomain({
        educationTasksDueToday: (educationRes.data ?? []) as EducationTask[],
        followUpsDueToday: (followUpsRes.data ?? []) as FollowUp[],
        habits: (habitsRes.data ?? []) as DailyGoalHabit[],
        completionsThisWeek: (completionsRes.data ?? []) as DailyGoalHabitCompletion[],
      })
      setDomainLoading(false)
    })

    return () => {
      cancelled = true
    }
    // habitsVersion: refetch when another widget (the morning routine
    // card) logs or removes a habit completion.
  }, [todayDateKey, weekStartKey, weekEndKeyExclusive, habitsVersion])

  const habitSchedule = useMemo(
    () => (domain ? computeHabitSchedule(domain.habits, domain.completionsThisWeek, todayDateKey) : []),
    [domain, todayDateKey]
  )

  const todosDueToday = useMemo(() => todos.filter((t) => t.due_date === todayDateKey), [todos, todayDateKey])

  const rollup = useMemo(
    () =>
      computeDailyGoalsRollup({
        todosDueToday,
        educationTasksDueToday: domain?.educationTasksDueToday ?? [],
        followUpsDueToday: domain?.followUpsDueToday ?? [],
        habitSchedule,
      }),
    [todosDueToday, domain, habitSchedule]
  )

  const checklist = useMemo(
    () => capChecklist(selectChecklistTodos(todos, todayDateKey, { includeStarred: true, keepIds }), keepIds),
    [todos, todayDateKey, keepIds]
  )

  const error = todosError ?? domainError

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodoText.trim()) return
    setAdding(true)
    const added = await addTodo(newTodoText)
    if (added) keep(added.id)
    setAdding(false)
    setNewTodoText('')
  }

  const handleToggle = async (id: string, title: string, wasCompleted: boolean) => {
    setAnnouncement(wasCompleted ? `Marked "${title}" not done` : `Marked "${title}" done`)
    keep(id)
    await toggleTodo(id)
  }

  const handleStar = async (id: string) => {
    keep(id)
    await toggleStar(id)
  }

  const moreParts = [
    checklist.doneCount > 0 ? `✓ ${checklist.doneCount} done` : null,
    checklist.hiddenCount > 0 ? `+${checklist.hiddenCount} more` : null,
  ].filter(Boolean)

  return (
    <ModuleGlassCard accent="neutral" className="flex flex-col gap-4">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <GlassCardHeader>
        <div className="-my-2.5 flex items-center justify-between gap-2 [@media(pointer:fine)]:my-0">
          <h2 className="flex min-w-0 items-center gap-2 font-display text-sm font-semibold text-foreground">
            <Target className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
            Personal todos
          </h2>
          <Link
            href="/todos"
            className="inline-flex min-h-11 shrink-0 items-center text-xs font-medium text-on-surface-variant hover:text-on-surface hover:underline [@media(pointer:fine)]:min-h-6"
          >
            All todos →
          </Link>
        </div>
      </GlassCardHeader>

      <GlassCardContent className="flex flex-col gap-4">
        <div className="text-xs text-on-surface-variant">
          {domainLoading && todosLoading ? 'Loading today…' : domainError ? "Couldn’t load today’s overall progress." :
            rollup.total === 0 ? 'Today overall: nothing scheduled' : `Today overall: ${rollup.completed}/${rollup.total} complete${rollup.extraCompletions > 0 ? ` · ${rollup.extraCompletions} extra` : ''}`}
        </div>

        {/* Todos checklist */}
        <div className="flex flex-col gap-3">
          {todosLoading ? (
            <ul className="flex flex-col gap-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-5 animate-pulse rounded bg-surface-container-high" />
              ))}
            </ul>
          ) : todosError ? (
            <p className="text-xs text-on-surface-variant">Couldn&apos;t load todos.</p>
          ) : checklist.rows.length === 0 ? (
            <p className="text-xs text-on-surface-variant">
              {checklist.doneCount > 0 && checklist.hiddenCount === 0
                ? 'All done for today.'
                : 'Nothing due, overdue or starred.'}
            </p>
          ) : (
            <ul className="divide-y divide-outline-variant/60">
              {checklist.rows.map((todo) => {
                const completed = todo.completed_at !== null
                const inputId = `daily-goals-todo-${todo.id}`
                const workspace = todo.workspace_id ? workspaces.get(todo.workspace_id) : undefined
                // Everything here is about today, so "Today" alone is noise —
                // but a reminder time, another day or overdue always shows.
                const dueLabel = formatDue(todo, todayDateKey)
                const due =
                  dueLabel && (todo.due_time || dueLabel.overdue || todo.due_date !== todayDateKey) ? dueLabel : null
                return (
                  <li key={todo.id} className="group grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 py-1.5">
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={completed}
                      onChange={() => handleToggle(todo.id, todo.title, completed)}
                      className="mt-0.5 h-4 w-4 cursor-pointer appearance-none rounded border border-outline-variant bg-transparent checked:border-primary-container checked:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50"
                    />
                    <label
                      htmlFor={inputId}
                      className={`cursor-pointer break-words text-sm ${
                        completed ? 'text-on-surface-variant line-through' : 'text-on-surface'
                      }`}
                    >
                      {todo.title}
                    </label>
                    <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-x-2">
                      {workspace && <WorkspaceChip workspace={workspace} />}
                      {due && (
                        <span className={`text-xs font-medium tabular-nums ${
                          due.overdue ? 'text-academic-orange' : 'text-on-surface-variant'
                        }`}>
                          {due.label}
                        </span>
                      )}
                      <div className="ml-auto flex items-center">
                        <button
                          type="button"
                          onClick={() => setEditingTodo(todo)}
                          aria-label={`Edit ${todo.title}`}
                          title="Edit"
                          className="shrink-0 rounded p-1.5 text-on-surface-variant transition-opacity hover:bg-surface-container-high hover:text-on-surface focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <StarButton starred={todo.starred} title={todo.title} onToggle={() => handleStar(todo.id)} />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {!todosLoading && !todosError && moreParts.length > 0 && (
            <Link
              href="/todos"
              className="inline-flex min-h-11 w-fit items-center text-xs font-medium text-on-surface-variant hover:text-on-surface hover:underline [@media(pointer:fine)]:min-h-6"
            >
              {moreParts.join(' · ')} →
            </Link>
          )}

          {syncStatus.state === 'needs_reconnect' && (
            <p className="text-xs text-on-surface-variant">
              Microsoft To Do needs reconnecting.{' '}
              <a href={TODO_CONNECT_HREF} className="font-medium text-on-surface hover:underline">
                Reconnect
              </a>
            </p>
          )}

          {error && <p className="text-xs text-academic-orange">{error}</p>}

          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <Input
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="Add a todo…"
              variant="outline"
              size="sm"
              aria-label="Add a todo"
              className="min-w-0 flex-1"
            />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              disabled={adding || !newTodoText.trim()}
              aria-label="Add todo"
              className="shrink-0 px-2"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </GlassCardContent>

      <TodoFormModal
        isOpen={editingTodo !== null}
        heading="Edit todo"
        initialValues={editingTodo}
        onClose={() => setEditingTodo(null)}
        onSave={(values) => {
          if (!editingTodo) return
          updateTodo(editingTodo.id, changedFields(editingTodo, values))
          setEditingTodo(null)
        }}
      />
    </ModuleGlassCard>
  )
}
