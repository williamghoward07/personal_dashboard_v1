import 'server-only'
import { generateStructured } from '@/lib/ai/gemini'
import type { AiSchema } from '@/lib/ai/schema'

export type SearchModule = 'people' | 'tasks' | 'todos' | 'transactions' | 'habits' | 'prompts'

export const SEARCH_MODULES: SearchModule[] = ['people', 'tasks', 'todos', 'transactions', 'habits', 'prompts']

export interface NlSearchExtraction {
  keywords: string[]
  targetModules: SearchModule[]
}

// Bare module names / a leading module word — resolved locally with zero
// API calls — a token-saving fast path.
const MODULE_ALIASES: Record<string, SearchModule> = {
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

function localFastPath(query: string): NlSearchExtraction | null {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return null

  const bareModule = MODULE_ALIASES[trimmed]
  if (bareModule) return { keywords: [], targetModules: [bareModule] }

  const [firstWord, ...rest] = trimmed.split(/\s+/)
  const prefixModule = MODULE_ALIASES[firstWord]
  if (prefixModule && rest.length > 0) {
    return { keywords: [rest.join(' ')], targetModules: [prefixModule] }
  }

  return null
}

const SCHEMA: AiSchema = {
  type: 'object',
  required: ['keywords', 'targetModules'],
  properties: {
    keywords: {
      type: 'array',
      description: 'Short search terms (names, topics, categories) pulled from the query — not the whole sentence.',
      items: { type: 'string' },
    },
    targetModules: {
      type: 'array',
      description:
        'Which of these the query is actually about: people (contacts), tasks (university coursework/deadlines), todos (general to-dos), transactions (spending/money), habits (habit tracking), prompts (saved AI prompts and research links). Include only modules genuinely relevant — most queries need just one or two.',
      items: { type: 'string', enum: SEARCH_MODULES },
    },
  },
}

// This is the entire AI-touched part of search — it returns keywords and
// module names, nothing else. No SQL, no query execution here; the
// caller runs plain ilike queries in hand-written TypeScript with these
// as inputs, which is what makes "no AI in the query-execution path"
// literally true rather than just a description.
export async function extractSearchQuery(query: string): Promise<NlSearchExtraction> {
  const fastPath = localFastPath(query)
  if (fastPath) return fastPath

  const prompt = `Extract search keywords and relevant modules from this query for a personal dashboard search.

Query: "${query}"

Return only keywords and module names — you are not writing a database query, just identifying what to search for and where.`

  const result = await generateStructured<NlSearchExtraction>({ prompt, schema: SCHEMA, feature: 'search' })

  // Defensive re-filter even though the schema already enums this — a
  // model response that ever drifts from the enum shouldn't be able to
  // make the caller query an unexpected table.
  return {
    keywords: result.keywords.filter((k) => k.trim().length > 0).slice(0, 5),
    targetModules: result.targetModules.filter((m): m is SearchModule => SEARCH_MODULES.includes(m as SearchModule)),
  }
}
