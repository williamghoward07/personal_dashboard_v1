// Browser-side calls to the Microsoft To Do sync routes
// (app/api/microsoft/todo/*). Pushes are best-effort: the app-side change
// has already been saved, so a failed push only returns a message to show.
// Every todo is pushed — the server decides from the saved row whether
// that means create, update or nothing.

import type { TodoSyncChanges } from '@/lib/microsoft/todo-mapping'
import type { TodoSyncIds } from './patch'

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

export interface PushOutcome {
  /** A message worth showing, or null. */
  error: string | null
  /** The row's To Do ids after a create/update, to refresh a local copy. */
  ids?: TodoSyncIds | null
}

async function push(body: object, { quietWhenDisconnected }: { quietWhenDisconnected: boolean }): Promise<PushOutcome> {
  try {
    const res = await fetch('/api/microsoft/todo/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string; state?: string; ids?: TodoSyncIds | null }
    if (res.ok) return { error: null, ids: data.ids }
    // Without a Microsoft connection the app simply works on its own; the
    // next pull after connecting creates whatever is missing.
    if (quietWhenDisconnected && res.status === 409 && data.state === 'not_connected') return { error: null }
    return { error: data.error ?? 'To Do sync failed' }
  } catch {
    return { error: "Couldn't reach the To Do sync." }
  }
}

/**
 * Creates the To Do task (or step) for a todo that was just added. Called
 * after every insert, from every place a todo can be made. A failure is
 * only logged — the next pull retries it.
 */
export async function pushTodoCreate(todoId: string): Promise<PushOutcome> {
  const outcome = await push({ todo_id: todoId, action: 'create' }, { quietWhenDisconnected: true })
  if (outcome.error) console.warn('[todos] To Do create failed, will retry on next pull:', outcome.error)
  return outcome
}

/** Sends an edit to To Do (creating the task first if it isn't linked yet). */
export function pushTodoChange(todoId: string, changes: TodoSyncChanges): Promise<PushOutcome> {
  return push({ todo_id: todoId, action: 'update', changes }, { quietWhenDisconnected: true })
}

/**
 * Deletes the linked To Do task or step. Call before deleting the todo
 * row; an unlinked todo answers straight away. Returns an error message,
 * or null.
 */
export async function pushTodoDelete(todoId: string): Promise<string | null> {
  return (await push({ todo_id: todoId, action: 'delete' }, { quietWhenDisconnected: false })).error
}

/** Whether a row id is a not-yet-saved optimistic placeholder. */
export const isOptimisticId = (id: string) => id.startsWith('optimistic-')

export const syncWarning = (message: string) => `Saved here, but not in Microsoft To Do: ${message}`
