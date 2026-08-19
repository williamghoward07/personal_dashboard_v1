import 'server-only'
import { generateStructured } from '@/lib/ai/gemini'
import type { AiSchema } from '@/lib/ai/schema'
export { looksLikeCommand } from './act-heuristics'

export type ActEntity = 'todo' | 'education_task' | 'calendar_event'

export interface ActDraft {
  entity: ActEntity
  title: string
  // ISO date (YYYY-MM-DD), resolved from relative phrases against referenceNow.
  due_date: string | null
  // 24h HH:mm — only meaningful for calendar_event.
  due_time: string | null
  notes: string | null
}

interface ActExtractResult {
  isAction: boolean
  draft: ActDraft | null
}

const SCHEMA: AiSchema = {
  type: 'object',
  required: ['isAction', 'draft'],
  properties: {
    isAction: {
      type: 'boolean',
      description: 'True only if this text is actually a command to create something — false for a search or question.',
    },
    draft: {
      type: 'object',
      nullable: true,
      description: 'Set only when isAction is true.',
      required: ['entity', 'title'],
      properties: {
        entity: {
          type: 'string',
          enum: ['todo', 'education_task', 'calendar_event'],
          description:
            'todo: a general to-do. education_task: coursework/an assignment/essay. calendar_event: something happening at a specific time (a session, a meeting) — usually implies a time of day.',
        },
        title: { type: 'string', description: 'Short title for the item.' },
        due_date: {
          type: 'string',
          nullable: true,
          description: 'ISO date (YYYY-MM-DD), resolved against the current date/time given below. Null if no date is implied.',
        },
        due_time: {
          type: 'string',
          nullable: true,
          description: '24h HH:mm, only if a specific time was mentioned (mainly relevant for calendar_event).',
        },
        notes: { type: 'string', nullable: true, description: 'Anything else worth keeping that has no other field.' },
      },
    },
  },
}

// Search mode 3 ("Act"). Reuses the People quick-add extraction shape
// directly — same "extract structured fields, never guess" contract. The
// caller must always show a confirmation step before writing; this
// function only ever produces a draft, never touches the database.
export async function extractActIntent(text: string, referenceNow: string): Promise<ActExtractResult> {
  const prompt = `You extract a single actionable item from a short command typed into a personal dashboard's universal search/command bar.

Current date/time: ${referenceNow}

Text: "${text}"

Decide whether this is actually a command to create something (not a search or a question), and if so extract the fields. Never invent a date or time that isn't stated or clearly implied.`

  return generateStructured<ActExtractResult>({ prompt, schema: SCHEMA, feature: 'search_act' })
}
