import 'server-only'
import { generateStructured } from '@/lib/ai/gemini'
import type { AiSchema } from '@/lib/ai/schema'
import type { SearchResultItem } from './types'

const SCHEMA: AiSchema = {
  type: 'object',
  required: ['answer'],
  properties: {
    answer: {
      type: 'string',
      description: 'A single short sentence directly answering the question, grounded only in the given results.',
    },
  },
}

const MAX_RESULTS_IN_PROMPT = 20

// Search mode 2 ("Answer"). Only ever called for a query that already
// parsed as a question (see isQuestion in nl-search.ts) — the caller gates
// this, never a plain keyword search, since results entering the prompt
// makes this the more expensive of the two calls a search can trigger.
export async function answerFromResults(query: string, results: SearchResultItem[]): Promise<string | null> {
  if (results.length === 0) return null

  const context = results
    .slice(0, MAX_RESULTS_IN_PROMPT)
    .map((r) => `- [${r.module}] ${r.title}${r.subtitle ? ` — ${r.subtitle}` : ''}`)
    .join('\n')

  const prompt = `Answer this question about the user's own personal-dashboard data, using only the results below. If the results don't contain enough to answer, say so briefly — never guess or use outside knowledge.

Question: "${query}"

Results:
${context}`

  try {
    const result = await generateStructured<{ answer: string }>({
      prompt,
      schema: SCHEMA,
      feature: 'search_answer',
      tier: 'smart',
      maxOutputTokens: 200,
    })
    return result.answer
  } catch (err) {
    console.error('Search answer generation failed:', err)
    return null
  }
}
