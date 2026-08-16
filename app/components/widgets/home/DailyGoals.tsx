'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Target, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { DailyGoalHabit, DailyGoalHabitCompletion, EducationTask } from '@/lib/types'
import { londonDayBoundsUTC, londonWeekBoundsUTC } from '@/lib/google/london-day'
import { computeHabitSchedule, computeDailyGoalsRollup } from '@/lib/daily-goals/rollup'
import { selectChecklistTodos } from '@/lib/daily-goals/checklist'
import { useTodos } from '@/lib/daily-goals/use-todos'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { GlassCardHeader, GlassCardContent } from '@/components/ui/glass-card'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface DomainData {
  educationTasksDueToday: EducationTask[]
  habits: DailyGoalHabit[]
  completionsThisWeek: DailyGoalHabitCompletion[]
}

export default function DailyGoals() {
  const { todayDateKey, weekStartKey, weekEndKeyExclusive } = useMemo(() => {
    const day = londonDayBoundsUTC()
    const week = londonWeekBoundsUTC()
    return { todayDateKey: day.startDateKey, weekStartKey: week.startDateKey, weekEndKeyExclusive: week.endDateKey }
  }, [])

  const { todos, loading: todosLoading, error: todosError, addTodo, toggleTodo } = useTodos(todayDateKey)

  const [domain, setDomain] = useState<DomainData | null>(null)
  const [domainLoading, setDomainLoading] = useState(true)
  const [domainError, setDomainError] = useState<string | null>(null)
  const [newTodoText, setNewTodoText] = useState('')
  const [adding, setAdding] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    // No setDomainLoading(true) here: `domainLoading` already starts
    // true, and todayDateKey/weekStartKey/weekEndKeyExclusive never
    // change within a session (see the useMemo above), so this effect
    // only ever runs once — calling setState synchronously at the top of
    // an effect body is flagged by react-hooks/set-state-in-effect.
    let cancelled = false

    Promise.all([
      supabase.from('education_tasks').select('*').eq('due_date', todayDateKey),
      supabase.from('daily_goal_habits').select('*').eq('is_active', true),
      supabase
        .from('daily_goal_habit_completions')
        .select('*')
        .gte('completed_on', weekStartKey)
        .lt('completed_on', weekEndKeyExclusive),
    ]).then(([educationRes, habitsRes, completionsRes]) => {
      if (cancelled) return

      const firstError = educationRes.error ?? habitsRes.error ?? completionsRes.error
      if (firstError) {
        setDomainError(firstError.message)
        setDomainLoading(false)
        return
      }

      setDomainError(null)
      setDomain({
        educationTasksDueToday: (educationRes.data ?? []) as EducationTask[],
        habits: (habitsRes.data ?? []) as DailyGoalHabit[],
        completionsThisWeek: (completionsRes.data ?? []) as DailyGoalHabitCompletion[],
      })
      setDomainLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [todayDateKey, weekStartKey, weekEndKeyExclusive])

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
        habitSchedule,
      }),
    [todosDueToday, domain, habitSchedule]
  )

  const checklistTodos = useMemo(() => selectChecklistTodos(todos, todayDateKey), [todos, todayDateKey])

  const error = todosError ?? domainError
  const ringPercent = rollup.total > 0 ? Math.round((rollup.completed / rollup.total) * 100) : 0

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodoText.trim()) return
    setAdding(true)
    await addTodo(newTodoText)
    setAdding(false)
    setNewTodoText('')
  }

  const handleToggle = async (id: string, title: string, wasCompleted: boolean) => {
    setAnnouncement(wasCompleted ? `Marked "${title}" not done` : `Marked "${title}" done`)
    await toggleTodo(id)
  }

  return (
    <ModuleGlassCard accent="neutral" className="flex flex-col gap-4">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <GlassCardHeader>
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
            <Target className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
            Daily Goals
          </h2>
          <Link
            href="/todos"
            className="shrink-0 text-xs font-medium text-on-surface-variant hover:text-on-surface hover:underline"
          >
            All todos →
          </Link>
        </div>
      </GlassCardHeader>

      <GlassCardContent className="flex flex-col gap-4">
        {/* Roll-up ring */}
        <div className="flex flex-col items-center gap-2 py-1">
          {domainLoading && todosLoading ? (
            <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-surface-container-high" />
          ) : domainError ? (
            <p className="text-center text-xs text-on-surface-variant">Couldn&apos;t load today&apos;s goals.</p>
          ) : (
            <div className={rollup.total === 0 ? 'opacity-60' : undefined}>
              <ProgressRing accent="neutral" value={ringPercent} size="md" showValue={false} />
            </div>
          )}
          {!(domainLoading && todosLoading) && !domainError && (
            <span className="font-display text-sm font-semibold text-on-surface">
              {rollup.total === 0
                ? 'Nothing scheduled today'
                : `${rollup.completed}/${rollup.total} today`}
              {rollup.extraCompletions > 0 && (
                <span className="ml-1 text-xs font-normal text-on-surface-variant">
                  +{rollup.extraCompletions} extra
                </span>
              )}
            </span>
          )}
        </div>

        {/* Divider, matching the border-t treatment used elsewhere for
            two-section widget cards (see the old GoalTicker). */}
        <div className="border-t border-outline-variant/50" />

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
          ) : checklistTodos.length === 0 ? (
            <p className="text-xs text-on-surface-variant">Nothing due or overdue.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {checklistTodos.map((todo) => {
                const completed = todo.completed_at !== null
                const inputId = `daily-goals-todo-${todo.id}`
                return (
                  <li key={todo.id} className="flex items-center gap-2">
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={completed}
                      onChange={() => handleToggle(todo.id, todo.title, completed)}
                      className="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-outline-variant bg-transparent checked:border-primary-container checked:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50"
                    />
                    <label
                      htmlFor={inputId}
                      className={`min-w-0 flex-1 cursor-pointer truncate text-sm ${
                        completed ? 'text-on-surface-variant line-through' : 'text-on-surface'
                      }`}
                    >
                      {todo.title}
                    </label>
                    {todo.overdue && !completed && (
                      <span className="shrink-0 text-xs font-medium text-academic-orange">Overdue</span>
                    )}
                  </li>
                )
              })}
            </ul>
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
    </ModuleGlassCard>
  )
}
