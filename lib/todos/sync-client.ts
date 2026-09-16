// Browser-side calls to the Microsoft To Do sync routes
// (app/api/microsoft/todo/*). Pushes are best-effort: the app-side change
// has already been saved, so a failed push only returns a message to show.

import type { TodoSyncChanges } from '@/lib/microsoft/todo-mapping'

export type TodoSyncState = 'idle' | 'syncing' | 'ok' | 'error' | 'not_connected' | 'needs_reconnect'

export interface TodoSyncStatus {
  state: TodoSyncState
  message?: string
  syncedAt?: string
}

export const TODO_CONNECT_HREF = '/api/microsoft/connect?next=/todos'

const LAST_PULL_KEY = 'mstodo:last-pull'
// The home widget pulls at most this often; the Todos page always pulls.
export const HOME_PULL_INTERVAL_MS = 5 * 60 * 1000

export async function pullMicrosoftTodo(): Promise<TodoSyncStatus> {
  try {
    const res = await fetch('/api/microsoft/todo/pull', { method: 'POST' })
    const body = (await res.json().catch(() => ({}))) as { state?: TodoSyncState; error?: string; syncedAt?: string }
    const state = body.state ?? (res.ok ? 'ok' : 'error')
    if (state === 'ok') {
      try {
        window.localStorage.setItem(LAST_PULL_KEY, String(Date.now()))
      } catch {
        // throttling is a convenience only
      }
    }
    return { state, message: body.error, syncedAt: body.syncedAt }
  } catch {
    return { state: 'error', message: "Couldn't reach the To Do sync." }
  }
}

/** Whether enough time has passed since the last successful pull in this browser. */
export function pullIsDue(intervalMs: number): boolean {
  try {
    const last = Number(window.localStorage.getItem(LAST_PULL_KEY) ?? 0)
    return Date.now() - last > intervalMs
  } catch {
    return true
  }
}

async function push(body: object): Promise<string | null> {
  try {
    const res = await fetch('/api/microsoft/todo/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return null
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return data.error ?? 'To Do sync failed'
  } catch {
    return "Couldn't reach the To Do sync."
  }
}

/** Sends an edit to the linked To Do task. Returns an error message, or null. */
export function pushTodoChange(todoId: string, changes: TodoSyncChanges): Promise<string | null> {
  return push({ todo_id: todoId, action: 'update', changes })
}

/** Deletes the linked To Do task. Call before deleting the todo row. */
export function pushTodoDelete(todoId: string): Promise<string | null> {
  return push({ todo_id: todoId, action: 'delete' })
}

export const syncWarning = (message: string) => `Saved here, but not in Microsoft To Do: ${message}`
