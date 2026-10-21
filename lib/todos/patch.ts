import type { TodoSyncChanges } from '@/lib/microsoft/todo-mapping'
import type { Todo } from '@/lib/types'

// The fields any todo editor (Todos page, home, workspaces, notes
// documents) can change, and which of them travel to Microsoft To Do.

export type TodoPatch = Partial<
  Pick<Todo, 'title' | 'notes' | 'due_date' | 'due_time' | 'list_id' | 'parent_id' | 'workspace_id' | 'starred'>
>

export type TodoSyncIds = Pick<Todo, 'mstodo_task_id' | 'mstodo_list_id' | 'mstodo_checklist_item_id'>

/** The part of an edit that is mirrored to the linked To Do task. */
export function syncedChanges(patch: TodoPatch): TodoSyncChanges {
  const changes: TodoSyncChanges = {}
  if (patch.title !== undefined) changes.title = patch.title
  if (patch.notes !== undefined) changes.notes = patch.notes
  if (patch.due_date !== undefined) changes.due_date = patch.due_date
  if (patch.due_time !== undefined) changes.due_time = patch.due_time
  if (patch.list_id !== undefined) changes.list_id = patch.list_id
  if (patch.starred !== undefined) changes.starred = patch.starred
  return changes
}

/** Only the fields that actually differ from `todo` (so a no-op save pushes nothing). */
export function changedFields(todo: Todo, patch: TodoPatch): TodoPatch {
  const out: TodoPatch = {}
  for (const key of Object.keys(patch) as (keyof TodoPatch)[]) {
    if (patch[key] !== todo[key]) (out as Record<string, unknown>)[key] = patch[key]
  }
  return out
}

/** Whether a todo row is linked to To Do (a task, or a step for a subtask). */
export function isSyncedTodo(todo: Pick<Todo, 'parent_id' | 'mstodo_task_id' | 'mstodo_checklist_item_id'>): boolean {
  return todo.parent_id ? todo.mstodo_checklist_item_id !== null : todo.mstodo_task_id !== null
}
