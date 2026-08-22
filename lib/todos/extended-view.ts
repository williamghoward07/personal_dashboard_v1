import type { Todo } from '@/lib/types'

export interface ExtendedViewGroups {
  overdue: Todo[]
  today: Todo[]
  tomorrow: Todo[]
  thisWeek: Todo[]
  later: Todo[]
  noDate: Todo[]
}

function parseDateKey(key: string): Date {
  return new Date(`${key}T00:00:00Z`)
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

// End of the current ISO week (Monday-start, so "this week" always means
// through the coming Sunday) — matches Europe/London's week convention,
// same locale basis as the Daily Verse feature elsewhere in this app.
function endOfWeekKey(todayDateKey: string): string {
  const today = parseDateKey(todayDateKey)
  const isoDayOfWeek = ((today.getUTCDay() + 6) % 7) + 1 // Monday=1..Sunday=7
  return toDateKey(addDays(today, 7 - isoDayOfWeek))
}

function sortByDueThenCreated(a: Todo, b: Todo): number {
  return (
    (a.due_date ?? '').localeCompare(b.due_date ?? '') ||
    (a.due_time ?? '').localeCompare(b.due_time ?? '') ||
    a.created_at.localeCompare(b.created_at)
  )
}

// From the full todo list, buckets by due date into the sections the
// extended/"later" view renders: Overdue, Today, Tomorrow, This Week
// (through the coming Sunday), Later, and No date — grouped by actual
// due date, matching iOS Reminders' "Scheduled" convention. Pure and
// Supabase-free, unit-testable without a database.
export function groupTodosForExtendedView(todos: Todo[], todayDateKey: string): ExtendedViewGroups {
  const tomorrowKey = toDateKey(addDays(parseDateKey(todayDateKey), 1))
  const weekEndKey = endOfWeekKey(todayDateKey)

  const groups: ExtendedViewGroups = {
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    later: [],
    noDate: [],
  }

  for (const todo of todos) {
    if (todo.due_date === null) {
      groups.noDate.push(todo)
    } else if (todo.due_date < todayDateKey) {
      groups.overdue.push(todo)
    } else if (todo.due_date === todayDateKey) {
      groups.today.push(todo)
    } else if (todo.due_date === tomorrowKey) {
      groups.tomorrow.push(todo)
    } else if (todo.due_date <= weekEndKey) {
      groups.thisWeek.push(todo)
    } else {
      groups.later.push(todo)
    }
  }

  groups.overdue.sort(sortByDueThenCreated)
  groups.thisWeek.sort(sortByDueThenCreated)
  groups.later.sort(sortByDueThenCreated)
  groups.noDate.sort((a, b) => a.created_at.localeCompare(b.created_at))

  return groups
}
