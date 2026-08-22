import type { TimeBlockCandidateItem } from './types'

// Trivial structural mapper, deliberately decoupled from lib/types.ts —
// callers pass already-filtered "due today" rows (selectChecklistTodos'
// output for todos, a plain due_date-equality filter for education tasks).
export function buildCandidateItems(
  todosDueOrOverdue: { id: string; title: string }[],
  educationTasksDueToday: { id: string; title: string }[]
): TimeBlockCandidateItem[] {
  return [
    ...todosDueOrOverdue.map((t) => ({ id: t.id, source: 'todo' as const, title: t.title })),
    ...educationTasksDueToday.map((t) => ({ id: t.id, source: 'education_task' as const, title: t.title })),
  ]
}
