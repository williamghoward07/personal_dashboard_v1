import 'server-only'
import { generateStructured } from '@/lib/ai/gemini'
import type { AiSchema } from '@/lib/ai/schema'
import { parseTimeWindow, TIME_WINDOWS, type TimeWindow } from './time-window'
import { SEARCH_MODULES, canSkipAi, localExtraction, localFastPath, type NlSearchExtraction, type SearchModule } from './local-query'

export { SEARCH_MODULES } from './local-query'
export type { SearchModule, NlSearchExtraction } from './local-query'

const SCHEMA: AiSchema = {
  type: 'object',
  required: ['keywords', 'targetModules'],
  properties: {
    keywords: {
      type: 'array',
      description:
        'Up to 5 search terms pulled from the query (names, topics, categories) — single words or short phrases, in base/singular form, not the whole sentence. When the user\'s word is a broad category, add 1–2 close synonyms (e.g. food → food, groceries, restaurant).',
      items: { type: 'string' },
    },
    targetModules: {
      type: 'array',
      description:
        'Which of these the query is actually about: people (contacts), tasks (university coursework/deadlines), todos (general to-dos), transactions (spending/money), habits (habit tracking), prompts (saved AI prompts and research links). Include only modules genuinely relevant — most queries need just one or two.',
      items: { type: 'string', enum: SEARCH_MODULES },
    },
    timeWindow: {
      type: 'string',
      nullable: true,
      enum: [...TIME_WINDOWS],
      description:
        'The time period the question is about, only if one is stated or clearly implied; otherwise null. E.g. "due tomorrow" -> tomorrow.',
    },
  },
}

// This is the entire AI-touched part of search — it returns keywords, module
// names and one value from a fixed enum of time windows. No SQL, no dates, no
// arithmetic here: code resolves the window to dates. No query execution; the
// caller runs plain ilike queries in hand-written TypeScript with these
// as inputs, which is what makes "no AI in the query-execution path"
// literally true rather than just a description. Short plain queries and
// any AI failure (budget reached, AI disabled, network) resolve locally.
export async function extractSearchQuery(query: string): Promise<NlSearchExtraction> {
  const fastPath = localFastPath(query)
  if (fastPath) return fastPath
  if (canSkipAi(query)) return localExtraction(query)

  const prompt = `Extract search keywords and relevant modules from this query for a personal dashboard search.

Query: "${query}"

Return only keywords, module names and a time window — you are not writing a database query, just identifying what to search for and where. Never put time words (today, this week, last month, due...) in keywords; they belong in timeWindow.`

  try {
    const result = await generateStructured<Omit<NlSearchExtraction, 'timeWindow'> & { timeWindow?: string | null }>({ prompt, schema: SCHEMA, feature: 'search' })

    // Defensive re-filter even though the schema already enums this — a
    // model response that ever drifts from the enum shouldn't be able to
    // make the caller query an unexpected table.
    return {
      keywords: result.keywords.filter((k) => k.trim().length > 0).slice(0, 5),
      targetModules: result.targetModules.filter((m): m is SearchModule => SEARCH_MODULES.includes(m as SearchModule)),
      // The local parser is deterministic, so it wins over the model.
      timeWindow:
        parseTimeWindow(query).window ??
        (TIME_WINDOWS.includes(result.timeWindow as TimeWindow) ? (result.timeWindow as TimeWindow) : null),
    }
  } catch (err) {
    console.error('NL search extraction failed, searching locally:', err)
    return localExtraction(query)
  }
}
