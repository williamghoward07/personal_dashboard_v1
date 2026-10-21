import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import type { Todo } from '@/lib/types'
import { GraphApiError } from './graph'
import {
  createChecklistItem,
  createTask,
  createTodoList,
  deleteChecklistItem,
  deleteTask,
  listTodoLists,
  updateChecklistItem,
  updateTask,
} from './todo'
import {
  changesToGraphPatch,
  changesToStepPatch,
  syncableLists,
  todoToTaskBody,
  type GraphTodoList,
  type TodoSyncChanges,
} from './todo-mapping'

// App → To Do writes. Every top-level todo is created as a To Do task
// (in the To Do list named like its app list, or the default "Tasks"
// list), and every subtask as a step on its parent's task. Called from
// the push route (any client-side add/edit/delete), from Capture's
// confirm route, and from the pull route's backfill — wherever a todo is
// made, it ends up in To Do.
//
// Linking is idempotent and race-safe: the ids are written back with a
// "still unlinked" condition, and if another request linked the todo
// first, the task or step just created is deleted again.

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

const SYNC_COLUMNS =
  'id, title, notes, due_date, due_time, completed_at, starred, list_id, parent_id, mstodo_task_id, mstodo_list_id, mstodo_checklist_item_id'

type SyncTodo = Pick<
  Todo,
  | 'id'
  | 'title'
  | 'notes'
  | 'due_date'
  | 'due_time'
  | 'completed_at'
  | 'starred'
  | 'list_id'
  | 'parent_id'
  | 'mstodo_task_id'
  | 'mstodo_list_id'
  | 'mstodo_checklist_item_id'
>

export type SyncResult = 'linked' | 'already_linked' | 'not_linked' | 'not_found' | 'ok'

// Backfill pass size — keeps one pull well inside Graph's throttling and
// the route's time budget; anything left over goes on the next pull.
export const BACKFILL_LIMIT = 25

const isNotFound = (error: unknown) => error instanceof GraphApiError && error.status === 404

async function ignoreNotFound(work: Promise<unknown>): Promise<void> {
  try {
    await work
  } catch (error) {
    if (!isNotFound(error)) throw error
  }
}

async function loadTodo(supabase: ServerSupabase, id: string): Promise<SyncTodo | null> {
  const { data } = await supabase.from('todos').select(SYNC_COLUMNS).eq('id', id).maybeSingle<SyncTodo>()
  return data ?? null
}

/**
 * Maps app lists to To Do lists by name (the same rule the pull uses in
 * reverse): no app list = the default "Tasks" list; a named list missing
 * in To Do is created there. Caches To Do's lists for one request.
 */
export class TodoListResolver {
  private lists: GraphTodoList[] | null = null

  constructor(
    private readonly supabase: ServerSupabase,
    private readonly accessToken: string
  ) {}

  private async graphLists(): Promise<GraphTodoList[]> {
    this.lists ??= syncableLists(await listTodoLists(this.accessToken))
    return this.lists
  }

  async graphListIdFor(appListId: string | null): Promise<string> {
    const lists = await this.graphLists()
    if (appListId) {
      const { data: appList } = await this.supabase
        .from('todo_lists')
        .select('name')
        .eq('id', appListId)
        .maybeSingle<{ name: string }>()
      const name = appList?.name.trim()
      if (name) {
        const match = lists.find(
          (l) => l.wellknownListName !== 'defaultList' && l.displayName.trim().toLowerCase() === name.toLowerCase()
        )
        if (match) return match.id
        const created = await createTodoList(this.accessToken, name)
        lists.push(created)
        return created.id
      }
    }
    const fallback = lists.find((l) => l.wellknownListName === 'defaultList')
    if (!fallback) throw new Error('No default To Do list found')
    return fallback.id
  }
}

/** Creates steps for a linked task's subtasks that don't have one yet. */
async function linkPendingSteps(supabase: ServerSupabase, accessToken: string, parent: SyncTodo): Promise<void> {
  if (!parent.mstodo_task_id || !parent.mstodo_list_id) return
  const { data: children } = await supabase
    .from('todos')
    .select(SYNC_COLUMNS)
    .eq('parent_id', parent.id)
    .is('mstodo_checklist_item_id', null)
    .order('created_at', { ascending: true })
  for (const child of (children ?? []) as SyncTodo[]) {
    await linkStepUnder(supabase, accessToken, child, parent)
  }
}

async function linkStepUnder(
  supabase: ServerSupabase,
  accessToken: string,
  step: SyncTodo,
  parent: SyncTodo
): Promise<SyncResult> {
  if (step.mstodo_checklist_item_id) return 'already_linked'
  const listId = parent.mstodo_list_id as string
  const taskId = parent.mstodo_task_id as string
  const item = await createChecklistItem(accessToken, listId, taskId, {
    displayName: step.title,
    isChecked: step.completed_at !== null,
  })
  const { data } = await supabase
    .from('todos')
    .update({ mstodo_checklist_item_id: item.id })
    .eq('id', step.id)
    .is('mstodo_checklist_item_id', null)
    .select('id')
  if (!data?.length) {
    await ignoreNotFound(deleteChecklistItem(accessToken, listId, taskId, item.id))
    return 'already_linked'
  }
  return 'linked'
}

/**
 * Creates the To Do task (or step, for a subtask) for an app todo. A
 * subtask whose parent isn't linked yet links the parent, which brings
 * every pending step with it.
 */
export async function linkTodo(
  supabase: ServerSupabase,
  accessToken: string,
  todoId: string,
  resolver = new TodoListResolver(supabase, accessToken)
): Promise<SyncResult> {
  const todo = await loadTodo(supabase, todoId)
  if (!todo) return 'not_found'

  if (todo.parent_id) {
    const parent = await loadTodo(supabase, todo.parent_id)
    if (!parent) return 'not_found'
    if (!parent.mstodo_task_id) return linkTodo(supabase, accessToken, parent.id, resolver)
    return linkStepUnder(supabase, accessToken, todo, parent)
  }

  if (todo.mstodo_task_id) {
    await linkPendingSteps(supabase, accessToken, todo)
    return 'already_linked'
  }

  const listId = await resolver.graphListIdFor(todo.list_id)
  const task = await createTask(accessToken, listId, todoToTaskBody(todo))
  const { data } = await supabase
    .from('todos')
    .update({ mstodo_task_id: task.id, mstodo_list_id: listId })
    .eq('id', todo.id)
    .is('mstodo_task_id', null)
    .select('id')
  if (!data?.length) {
    await ignoreNotFound(deleteTask(accessToken, listId, task.id))
    return 'already_linked'
  }

  await linkPendingSteps(supabase, accessToken, { ...todo, mstodo_task_id: task.id, mstodo_list_id: listId })
  return 'linked'
}

/**
 * Sends an app-side edit (already saved) to the linked task or step.
 * Reminder fields are read back from the saved row so the date and time
 * always travel together. A list change recreates the task in the new
 * list — Graph can't move a task between lists.
 */
export async function pushTodoUpdate(
  supabase: ServerSupabase,
  accessToken: string,
  todoId: string,
  changes: TodoSyncChanges
): Promise<SyncResult> {
  const todo = await loadTodo(supabase, todoId)
  if (!todo) return 'not_found'

  if (todo.parent_id) {
    if (!todo.mstodo_checklist_item_id) return 'not_linked'
    const parent = await loadTodo(supabase, todo.parent_id)
    if (!parent?.mstodo_task_id || !parent.mstodo_list_id) return 'not_linked'
    const patch = changesToStepPatch(changes)
    if (Object.keys(patch).length > 0) {
      await updateChecklistItem(accessToken, parent.mstodo_list_id, parent.mstodo_task_id, todo.mstodo_checklist_item_id, patch)
    }
    return 'ok'
  }

  if (!todo.mstodo_task_id || !todo.mstodo_list_id) return 'not_linked'

  if (changes.list_id !== undefined) {
    const targetListId = await new TodoListResolver(supabase, accessToken).graphListIdFor(todo.list_id)
    if (targetListId !== todo.mstodo_list_id) {
      await moveTask(supabase, accessToken, todo, targetListId)
      return 'ok'
    }
  }

  const full: TodoSyncChanges = { ...changes }
  delete full.list_id
  if (full.due_date !== undefined || full.due_time !== undefined) {
    full.due_date = todo.due_date
    full.due_time = todo.due_time
  }
  const patch = changesToGraphPatch(full)
  if (Object.keys(patch).length > 0) {
    await updateTask(accessToken, todo.mstodo_list_id, todo.mstodo_task_id, patch)
  }
  return 'ok'
}

async function moveTask(supabase: ServerSupabase, accessToken: string, todo: SyncTodo, targetListId: string) {
  const task = await createTask(accessToken, targetListId, todoToTaskBody(todo))
  const { error } = await supabase
    .from('todos')
    .update({ mstodo_task_id: task.id, mstodo_list_id: targetListId })
    .eq('id', todo.id)
  if (error) {
    await ignoreNotFound(deleteTask(accessToken, targetListId, task.id))
    throw new Error(error.message)
  }
  // The old task's steps go with it; recreate them on the new task.
  await supabase.from('todos').update({ mstodo_checklist_item_id: null }).eq('parent_id', todo.id)
  await linkPendingSteps(supabase, accessToken, { ...todo, mstodo_task_id: task.id, mstodo_list_id: targetListId })
  await ignoreNotFound(deleteTask(accessToken, todo.mstodo_list_id as string, todo.mstodo_task_id as string))
}

/** Deletes the linked task or step. Call before deleting the todo row. */
export async function pushTodoRemoval(
  supabase: ServerSupabase,
  accessToken: string,
  todoId: string
): Promise<SyncResult> {
  const todo = await loadTodo(supabase, todoId)
  if (!todo) return 'not_found'

  if (todo.parent_id) {
    if (!todo.mstodo_checklist_item_id) return 'not_linked'
    const parent = await loadTodo(supabase, todo.parent_id)
    if (!parent?.mstodo_task_id || !parent.mstodo_list_id) return 'not_linked'
    await ignoreNotFound(
      deleteChecklistItem(accessToken, parent.mstodo_list_id, parent.mstodo_task_id, todo.mstodo_checklist_item_id)
    )
    return 'ok'
  }

  if (!todo.mstodo_task_id || !todo.mstodo_list_id) return 'not_linked'
  await ignoreNotFound(deleteTask(accessToken, todo.mstodo_list_id, todo.mstodo_task_id))
  return 'ok'
}

/**
 * Creates To Do tasks for open todos that aren't linked yet — the
 * one-time backfill of older app-only todos, and the retry for any create
 * that failed (offline, not connected at the time). Also pushes subtasks
 * added under already-linked todos. Stops on an auth failure.
 */
export async function linkUnsyncedTodos(
  supabase: ServerSupabase,
  accessToken: string,
  limit = BACKFILL_LIMIT
): Promise<{ linked: number; failed: number }> {
  const resolver = new TodoListResolver(supabase, accessToken)
  let linked = 0
  let failed = 0

  const { data: unlinked } = await supabase
    .from('todos')
    .select('id')
    .is('mstodo_task_id', null)
    .is('parent_id', null)
    .is('completed_at', null)
    .order('created_at', { ascending: true })
    .limit(limit)

  const { data: pendingSteps } = await supabase
    .from('todos')
    .select('parent_id')
    .not('parent_id', 'is', null)
    .is('mstodo_checklist_item_id', null)
    .limit(limit)

  const ids = [
    ...(unlinked ?? []).map((t) => t.id as string),
    ...new Set((pendingSteps ?? []).map((t) => t.parent_id as string)),
  ]

  for (const id of ids) {
    try {
      const todo = await loadTodo(supabase, id)
      // A pending step under an unlinked, finished parent stays app-only.
      if (!todo || (!todo.mstodo_task_id && todo.completed_at)) continue
      const result = await linkTodo(supabase, accessToken, id, resolver)
      if (result === 'linked') linked++
    } catch (error) {
      failed++
      console.error('To Do backfill failed for', id, error)
      if (error instanceof GraphApiError && (error.status === 401 || error.status === 403)) break
    }
  }
  return { linked, failed }
}
