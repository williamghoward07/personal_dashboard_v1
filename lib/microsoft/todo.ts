import 'server-only'
import { graphRequest } from './graph'
import type { GraphTodoList, GraphTodoTask } from './todo-mapping'

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
