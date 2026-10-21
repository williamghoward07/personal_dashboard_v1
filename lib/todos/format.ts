import type { Todo } from '@/lib/types'

// One way of writing a todo's due date and reminder time, used by every
// todo row (Todos page, home checklist, workspaces, notes documents) so
// the time is always shown wherever a todo is. Pure; dates are London
// 'YYYY-MM-DD' keys, compared as calendar days.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface DueLabel {
  /** e.g. "Today · 14:30", "Fri · 09:00", "Mon 3 Nov", "Overdue · Tue 7 Oct" */
  label: string
  overdue: boolean
}

function toUtcDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function dayDiff(from: string, to: string): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000)
}

function dayName(dueDate: string, todayKey: string): string {
  const diff = dayDiff(todayKey, dueDate)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  const date = toUtcDate(dueDate)
  const weekday = WEEKDAYS[date.getUTCDay()]
  // This coming week: the weekday alone is unambiguous.
  if (diff > 1 && diff < 7) return weekday
  const sameYear = dueDate.slice(0, 4) === todayKey.slice(0, 4)
  return `${weekday} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}${sameYear ? '' : ` ${date.getUTCFullYear()}`}`
}

/** The due label for a todo, or null when it has no date. */
export function formatDue(
  todo: Pick<Todo, 'due_date' | 'due_time' | 'completed_at'>,
  todayKey: string
): DueLabel | null {
  if (!todo.due_date) return null
  const overdue = todo.completed_at === null && todo.due_date < todayKey
  const day = dayName(todo.due_date, todayKey)
  const when = todo.due_time ? `${day} · ${todo.due_time}` : day
  return { label: overdue ? `Overdue · ${when}` : when, overdue }
}
