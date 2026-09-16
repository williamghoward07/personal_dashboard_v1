import type { Todo, WorkspaceLink, WorkspaceLinkTodo, WorkspaceNote } from '@/lib/types'
import { SOURCE_KINDS, SOURCE_KIND_ORDER } from './kinds'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100)
}

/** Share of this workspace's scoped actions that are complete. */
export function taskProgress(todos: Todo[]): { completed: number; percent: number } {
  const completed = todos.filter((t) => t.completed_at).length
  return { completed, percent: percent(completed, todos.length) }
}

/** Source count by type, plus the share that have a type assigned. */
export function sourceFootprint(links: WorkspaceLink[]): { breakdown: string; percent: number } {
  const breakdown = SOURCE_KIND_ORDER.map((kind) => {
    const count = links.filter((l) => l.kind === kind).length
    return count > 0 ? `${count} ${SOURCE_KINDS[kind].label.toLowerCase()}${count === 1 ? '' : 's'}` : null
  })
    .filter((s): s is string => !!s)
    .join(' · ')

  const classified = links.filter((l) => l.kind !== 'other').length
  return { breakdown, percent: percent(classified, links.length) }
}

/** Share of scoped actions attached to at least one source. */
export function sourceCoupling(
  todos: Todo[],
  linkTodos: WorkspaceLinkTodo[]
): { coupled: number; percent: number } {
  const coupledIds = new Set(linkTodos.map((lt) => lt.todo_id))
  const coupled = todos.filter((t) => coupledIds.has(t.id)).length
  return { coupled, percent: percent(coupled, todos.length) }
}

/**
 * Share of log entries written in the last 7 days. `now` is a parameter so
 * this stays pure and testable — callers in render pass nothing and get the
 * current clock, the same arrangement as relativeTime()/logTimestamp().
 */
export function recentLogShare(notes: WorkspaceNote[], now: number = Date.now()): number {
  if (notes.length === 0) return 0
  const cutoff = now - WEEK_MS
  const recent = notes.filter((n) => new Date(n.created_at).getTime() >= cutoff).length
  return percent(recent, notes.length)
}
