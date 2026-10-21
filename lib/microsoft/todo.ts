import 'server-only'
import { graphRequest } from './graph'
import type { GraphChecklistItem, GraphTodoList, GraphTodoTask } from './todo-mapping'

// Microsoft To Do via Graph (/me/todo). Delegated Tasks.ReadWrite on a
// personal account. Every call is made on demand (a pull when the Todos
// page / home widget loads, a push when a synced todo changes) — well
// inside Graph's per-user throttling.

interface Page<T> {
  value: T[]
  '@odata.nextLink'?: string
}

async function getAll<T>(accessToken: string, path: string): Promise<T[]> {
  const items: T[] = []
  let next: string | undefined = path
  while (next) {
    const page: Page<T> | null = await graphRequest<Page<T>>(accessToken, next)
    items.push(...(page?.value ?? []))
    next = page?.['@odata.nextLink']
  }
  return items
}

export function listTodoLists(accessToken: string): Promise<GraphTodoList[]> {
  return getAll<GraphTodoList>(accessToken, '/me/todo/lists')
}

// No $select: Graph returns RequestBroker--ParseUri on /tasks with a
// $select query on this tenant, even for a minimal id,title list — so the
// full task is fetched and mapTaskToRow (todo-mapping.ts) just reads the
// fields it needs off it.
export function listTasks(accessToken: string, listId: string): Promise<GraphTodoTask[]> {
  return getAll<GraphTodoTask>(accessToken, `/me/todo/lists/${encodeURIComponent(listId)}/tasks?$top=100`)
}

/** Tasks with their steps inlined (`checklistItems`). */
export function listTasksWithSteps(accessToken: string, listId: string): Promise<GraphTodoTask[]> {
  return getAll<GraphTodoTask>(
    accessToken,
    `/me/todo/lists/${encodeURIComponent(listId)}/tasks?$top=100&$expand=checklistItems`
  )
}

export async function createTodoList(accessToken: string, displayName: string): Promise<GraphTodoList> {
  const created = await graphRequest<GraphTodoList>(accessToken, '/me/todo/lists', {
    method: 'POST',
    body: { displayName },
  })
  if (!created) throw new Error('To Do returned no list after create')
  return created
}

const stepsPath = (listId: string, taskId: string) =>
  `/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}/checklistItems`

/** Add a step (checklist item) to a task. */
export async function createChecklistItem(
  accessToken: string,
  listId: string,
  taskId: string,
  body: { displayName: string; isChecked: boolean }
): Promise<GraphChecklistItem> {
  const created = await graphRequest<GraphChecklistItem>(accessToken, stepsPath(listId, taskId), {
    method: 'POST',
    body,
  })
  if (!created) throw new Error('To Do returned no step after create')
  return created
}

export async function updateChecklistItem(
  accessToken: string,
  listId: string,
  taskId: string,
  itemId: string,
  patch: Record<string, unknown>
): Promise<void> {
  await graphRequest(accessToken, `${stepsPath(listId, taskId)}/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: patch,
  })
}

export async function deleteChecklistItem(
  accessToken: string,
  listId: string,
  taskId: string,
  itemId: string
): Promise<void> {
  await graphRequest(accessToken, `${stepsPath(listId, taskId)}/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
  })
}

export async function updateTask(
  accessToken: string,
  listId: string,
  taskId: string,
  patch: Record<string, unknown>
): Promise<void> {
  await graphRequest(accessToken, `/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: patch,
  })
}

export async function deleteTask(accessToken: string, listId: string, taskId: string): Promise<void> {
  await graphRequest(accessToken, `/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  })
}

/** Create a task (POST returns the new task). Body is a Graph `todoTask`. */
export async function createTask(
  accessToken: string,
  listId: string,
  body: Record<string, unknown>
): Promise<GraphTodoTask> {
  const created = await graphRequest<GraphTodoTask>(accessToken, `/me/todo/lists/${encodeURIComponent(listId)}/tasks`, {
    method: 'POST',
    body,
  })
  if (!created) throw new Error('To Do returned no task after create')
  return created
}

/** The default "Tasks" list — where the app's own todos (no list) map to. */
export async function getDefaultListId(accessToken: string): Promise<string> {
  const lists = await listTodoLists(accessToken)
  const list = lists.find((l) => l.wellknownListName === 'defaultList')
  if (!list) throw new Error('No default To Do list found')
  return list.id
}
