import type { Todo } from '@/lib/types'
import { londonDateKey } from '@/lib/google/london-day'

export interface ChecklistTodo extends Todo {
  overdue: boolean
}

// From a broad fetch (e.g. "incomplete OR due today OR finished today"),
// select exactly what the Daily Goals checklist should show: everything
// due today (any completion state, so a just-ticked item stays visible
// for undo) plus incomplete todos whose due_date has already passed.
// Future-dated todos are intentionally excluded — this checklist is a
// "today" view, not the full todo list. Undated todos are excluded too,
// unless `includeStarred` is set: then a starred undated todo is always
// on the list (and stays there on the day it's ticked). `keepIds` are
// undated todos touched this visit — kept so unstarring one doesn't make
// it vanish before it can be re-starred.
//
// Order: starred, then overdue, then due today.
//
// Pure and Supabase-free on purpose so overdue/ordering behaviour is
// unit-testable without a database.
export function selectChecklistTodos(
  todos: Todo[],
  todayDateKey: string,
  { includeStarred = false, keepIds }: { includeStarred?: boolean; keepIds?: ReadonlySet<string> } = {}
): ChecklistTodo[] {
  return todos
    .filter(
      (t) =>
        t.due_date === todayDateKey ||
        (t.due_date !== null && t.due_date < todayDateKey && t.completed_at === null) ||
        (t.due_date === null &&
          ((includeStarred && t.starred) || !!keepIds?.has(t.id)) &&
          (t.completed_at === null || londonDateKey(t.completed_at) === todayDateKey))
    )
    .map((t) => ({ ...t, overdue: t.due_date !== null && t.due_date < todayDateKey }))
    .sort((a, b) => {
      if (a.starred !== b.starred) return a.starred ? -1 : 1
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      return (a.due_date ?? '').localeCompare(b.due_date ?? '') || a.created_at.localeCompare(b.created_at)
    })
}

export const CHECKLIST_MAX_OPEN = 5

export interface CappedChecklist<T> {
  rows: T[]
  /** Incomplete todos past the cap. */
  hiddenCount: number
  /** Completed todos folded away (ticked before this visit). */
  doneCount: number
}

// Keeps the Daily Goals card a fixed size: at most `maxOpen` incomplete
// rows, with completed ones folded into a count. `keepIds` (ticked or
// added during this visit) always stay in place, so ticking a row never
// makes it jump away and a just-added todo is always visible.
export function capChecklist<T extends Pick<Todo, 'id' | 'completed_at'>>(
  items: T[],
  keepIds: ReadonlySet<string>,
  maxOpen = CHECKLIST_MAX_OPEN
): CappedChecklist<T> {
  const rows: T[] = []
  let open = 0
  let hiddenCount = 0
  let doneCount = 0

  for (const item of items) {
    const kept = keepIds.has(item.id)
    if (item.completed_at !== null) {
      if (kept) rows.push(item)
      else doneCount++
    } else if (kept || open < maxOpen) {
      rows.push(item)
      open++
    } else {
      hiddenCount++
    }
  }

  return { rows, hiddenCount, doneCount }
}
