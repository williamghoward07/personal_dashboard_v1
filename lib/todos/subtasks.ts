import type { Todo } from '@/lib/types'

export interface TodoParentGroups {
  topLevel: Todo[]
  childrenByParent: Record<string, Todo[]>
}

// Splits a flat todo list into top-level todos + a parent_id -> children
// map, so a row renderer can walk topLevel and look up each one's
// subtasks without duplicating children as standalone list entries.
// Single-level only (matching the DB guard trigger that rejects
// grandchildren) — a todo with its own parent_id never appears as a key.
export function groupByParent(todos: Todo[]): TodoParentGroups {
  const topLevel: Todo[] = []
  const childrenByParent: Record<string, Todo[]> = {}

  for (const todo of todos) {
    if (todo.parent_id) {
      ;(childrenByParent[todo.parent_id] ??= []).push(todo)
    } else {
      topLevel.push(todo)
    }
  }

  return { topLevel, childrenByParent }
}
