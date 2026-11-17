// Pure, browser-safe and server-only-free: the no-AI half of Find's query
// understanding. nl-search.ts (server-only) re-exports the types from here.
import { isQuestion } from './query-mode'
import { parseTimeWindow, type TimeWindow } from './time-window'

export type SearchModule = 'people' | 'tasks' | 'todos' | 'transactions' | 'habits' | 'prompts'

export const SEARCH_MODULES: SearchModule[] = ['people', 'tasks', 'todos', 'transactions', 'habits', 'prompts']

export interface NlSearchExtraction {
  keywords: string[]
  targetModules: SearchModule[]
  /** The period the query is about, if any. Resolved to dates in code, never by the model. */
  timeWindow: TimeWindow | null
}

// Bare module names / a leading module word — resolved locally with zero
// API calls — a token-saving fast path.
export const MODULE_ALIASES: Record<string, SearchModule> = {
  people: 'people',
  contacts: 'people',
  tasks: 'tasks',
  task: 'tasks',
  education: 'tasks',
  module: 'tasks',
  modules: 'tasks',
  todos: 'todos',
  todo: 'todos',
  transactions: 'transactions',
  transaction: 'transactions',
  money: 'transactions',
  spending: 'transactions',
  habits: 'habits',
  habit: 'habits',
  prompts: 'prompts',
  prompt: 'prompts',
  research: 'prompts',
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'on', 'in', 'at', 'to', 'for', 'my', 'me', 'i', 'and', 'or', 'with', 'about', 'from', 'by',
  'did', 'do', 'does', 'is', 'are', 'was', 'were', 'all', 'any', 'show', 'find', 'search', 'list', 'get', 'spent', 'spend', 'due',
  // Question words: when the AI call fails, a whole question is tokenised here.
  'what', 'how', 'much', 'many', 'when', 'where', 'who', 'which', 'why', 'have', 'has', 'can', 'should',
])

const MAX_KEYWORDS = 5

/** Lower-case content words of a query: stopwords dropped, naively singularised. */
export function tokeniseQuery(query: string): string[] {
  const out: string[] = []
  for (const raw of query.toLowerCase().split(/[^\p{L}\p{N}']+/u)) {
    const token = raw.replace(/^'+|'+$/g, '')
    if (token.length < 2 || STOPWORDS.has(token)) continue
    // "%essay%" still matches "essays", so stripping a trailing s is safe.
    const singular = token.length > 3 && token.endsWith('s') && !token.endsWith('ss') ? token.slice(0, -1) : token
    if (!out.includes(singular)) out.push(singular)
    if (out.length === MAX_KEYWORDS) break
  }
  return out
}

// Time phrases are stripped first so "food last month" searches for food, not
// for the words "last" and "month".
function withWindow(query: string): { timeWindow: TimeWindow | null; rest: string } {
  const { window, rest } = parseTimeWindow(query)
  return { timeWindow: window, rest }
}

export function localFastPath(query: string): NlSearchExtraction | null {
  const { timeWindow, rest: stripped } = withWindow(query)
  // The query was only a time phrase (e.g. "this week"): nothing to match on.
  if (timeWindow && !stripped.trim()) return { keywords: [], targetModules: [], timeWindow }

  const trimmed = stripped.trim().toLowerCase()
  if (!trimmed) return null

  const bareModule = MODULE_ALIASES[trimmed]
  if (bareModule) return { keywords: [], targetModules: [bareModule], timeWindow }

  const [firstWord, ...rest] = trimmed.split(/\s+/)
  const prefixModule = MODULE_ALIASES[firstWord]
  if (prefixModule && rest.length > 0) {
    return { keywords: tokeniseQuery(rest.join(' ')), targetModules: [prefixModule], timeWindow }
  }

  return null
}

/** The extraction with no AI at all — also the fallback when the AI call fails. */
export function localExtraction(query: string): NlSearchExtraction {
  const fast = localFastPath(query)
  if (fast) return fast
  const { timeWindow, rest } = withWindow(query)
  return { keywords: tokeniseQuery(rest), targetModules: [], timeWindow }
}

/** Short, non-question, digit-free queries gain nothing from an AI call. */
export function canSkipAi(query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed || isQuestion(trimmed)) return false
  if (/\d/.test(trimmed)) return false
  // Judged on what's left once a time phrase is removed.
  const rest = parseTimeWindow(trimmed).rest
  if (!rest) return true
  return rest.split(/\s+/).length <= 3
}
