import 'server-only'
import { generateStructured } from '@/lib/ai/gemini'
import type { AiSchema } from '@/lib/ai/schema'
import type { InteractionChannel } from '@/lib/types'

export type NlExtractIntent = 'new_person' | 'update_person' | 'log_interaction'

export interface NlPersonMatch {
  id: string
  confidence: number
}

export interface NlExtractedPerson {
  full_name: string | null
  email: string | null
  phone: string | null
  company: string | null
  job_title: string | null
  how_we_met: string | null
  notes: string | null
  tags: string[] | null
}

export interface NlExtractedInteraction {
  summary: string
  occurred_at: string | null
  channel: InteractionChannel | null
  follow_up: string | null
}

export interface NlExtractResult {
  intent: NlExtractIntent
  person_match: NlPersonMatch | null
  person: NlExtractedPerson | null
  interaction: NlExtractedInteraction | null
}

export interface PersonCandidate {
  id: string
  full_name: string
}

const SCHEMA: AiSchema = {
  type: 'object',
  required: ['intent', 'person_match', 'person', 'interaction'],
  properties: {
    intent: {
      type: 'string',
      enum: ['new_person', 'update_person', 'log_interaction'],
      description:
        'new_person: introduces someone not in the candidate list. update_person: gives new or changed info about someone already in the candidate list (job change, contact details, notes). log_interaction: describes something that happened — a conversation, meeting, or call.',
    },
    person_match: {
      type: 'object',
      nullable: true,
      description: 'The existing person this is about, chosen only from the candidate list — never invent an id.',
      required: ['id', 'confidence'],
      properties: {
        id: { type: 'string', description: 'Exact id copied from the candidate list.' },
        confidence: { type: 'number', description: '0 to 1: how sure this is the right person.' },
      },
    },
    person: {
      type: 'object',
      nullable: true,
      description:
        'Fields to create or update on the person. Leave a field null if the text does not mention it — never guess or invent a value.',
      properties: {
        full_name: { type: 'string', nullable: true },
        email: { type: 'string', nullable: true },
        phone: { type: 'string', nullable: true },
        company: { type: 'string', nullable: true },
        job_title: { type: 'string', nullable: true },
        how_we_met: { type: 'string', nullable: true },
        notes: { type: 'string', nullable: true, description: 'Anything worth remembering that has no other field.' },
        tags: { type: 'array', nullable: true, items: { type: 'string' } },
      },
    },
    interaction: {
      type: 'object',
      nullable: true,
      description: 'Only set when intent is log_interaction.',
      required: ['summary'],
      properties: {
        summary: { type: 'string', description: 'Short summary of what happened.' },
        occurred_at: {
          type: 'string',
          nullable: true,
          description:
            'ISO 8601 date or date-time, resolved against the current date/time given below, if the text implies a specific time ("yesterday", "this morning"). Null if unclear.',
        },
        channel: {
          type: 'string',
          nullable: true,
          enum: ['in_person', 'call', 'video', 'message', 'email', 'other'],
        },
        follow_up: { type: 'string', nullable: true, description: 'Something to bring up next time, if mentioned.' },
      },
    },
  },
}

// referenceNow is threaded through rather than read from the wall clock
// here, so a relative phrase like "yesterday" resolves deterministically
// and this stays testable the same way every other date-sensitive pure
// function in this app is — the caller (the API route) supplies the real
// current time.
export async function extractPeopleUpdate(
  text: string,
  candidates: PersonCandidate[],
  referenceNow: string
): Promise<NlExtractResult> {
  const candidateList = candidates.map((c) => `${c.id}: ${c.full_name}`).join('\n') || '(none yet)'

  const prompt = `You extract structured updates for a personal contacts app from a short note the user typed.

Current date/time: ${referenceNow}

Existing people (id: name) — match against these only, never invent an id:
${candidateList}

Note: "${text}"

Decide the intent, whether this refers to one of the existing people above, and extract whatever fields the note actually states. Never guess a field that isn't stated or clearly implied.`

  return generateStructured<NlExtractResult>({ prompt, schema: SCHEMA })
}
