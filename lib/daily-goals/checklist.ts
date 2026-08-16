import type { Todo } from '@/lib/types'

export interface ChecklistTodo extends Todo {
  overdue: boolean
}

// From a broad fetch (e.g. "incomplete OR due today"), select exactly
// what the Daily Goals checklist should show: everything due today
// (any completion state, so a just-ticked item stays visible for undo)
// plus incomplete todos whose due_date has already passed. Undated
// todos and future-dated ones are intentionally excluded — this
// checklist is a "today" view, not the full todo list.
//
// Pure and Supabase-free on purpose so overdue/ordering behaviour is
// unit-testable without a database.
export function selectChecklistTodos(todos: Todo[], todayDateKey: string): ChecklistTodo[] {
  return todos
    .filter(
      (t) =>
        t.due_date === todayDateKey ||
        (t.due_date !== null && t.due_date < todayDateKey && t.completed_at === null)
    )
    .map((t) => ({ ...t, overdue: t.due_date !== null && t.due_date < todayDateKey }))
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      return (a.due_date ?? '').localeCompare(b.due_date ?? '') || a.created_at.localeCompare(b.created_at)
    })
}
