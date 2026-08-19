// Split out of lib/search/act.ts (which is 'server-only') so the client
// search bar can run the same zero-cost gate before deciding whether to
// hit /api/search/act at all — avoids a wasted round trip on an ordinary
// search or question.
const ACTION_VERBS = ['add', 'create', 'new', 'remind me to', 'log', 'schedule']
const DUE_PATTERN = /\bdue\b/

export function looksLikeCommand(query: string): boolean {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return false
  if (DUE_PATTERN.test(trimmed)) return true
  return ACTION_VERBS.some((verb) => trimmed.startsWith(verb))
}
