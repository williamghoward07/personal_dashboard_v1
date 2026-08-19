import 'server-only'
import { generateStructured } from '@/lib/ai/gemini'
import type { AiSchema } from '@/lib/ai/schema'
import type { ActDraft, ActEntity } from '@/lib/search/act'
import type {
  NlExtractedInteraction,
  NlExtractedPerson,
  NlPersonMatch,
  PersonCandidate,
} from '@/lib/people/nl-extract'

export type BrainDumpDraftKind =
  | 'todo'
  | 'education_task'
  | 'calendar_event'
  | 'new_person'
  | 'update_person'
  | 'log_interaction'

export interface BrainDumpActFields {
  title: string
  due_date: string | null
  due_time: string | null
  notes: string | null
}

export interface BrainDumpDraft {
  kind: BrainDumpDraftKind
  // Set only when kind is todo/education_task/calendar_event.
  act: BrainDumpActFields | null
  // Set only when kind is update_person/log_interaction.
  person_match: NlPersonMatch | null
  // Set only when kind is new_person/update_person.
  person: NlExtractedPerson | null
  // Set only when kind is log_interaction.
  interaction: NlExtractedInteraction | null
}

export interface BrainDumpExtractResult {
  drafts: BrainDumpDraft[]
}

const ACT_KINDS: ActEntity[] = ['todo', 'education_task', 'calendar_event']

// Maps a draft back onto the exact shape app/api/search/act/confirm
// already knows how to write — the brain dump reuses that write path
// rather than introducing a second one.
export function toActDraft(draft: BrainDumpDraft): ActDraft | null {
  if (!draft.act) return null
  if (!ACT_KINDS.includes(draft.kind as ActEntity)) return null
  return {
    entity: draft.kind as ActEntity,
    title: draft.act.title,
    due_date: draft.act.due_date,
    due_time: draft.act.due_time,
    notes: draft.act.notes,
  }
}

// One array item's schema reuses the exact field definitions from
// lib/search/act.ts's ActDraft schema and lib/people/nl-extract.ts's
// person/interaction schemas — the only new part is the array wrapper
// and the `kind` discriminator that replaces ActDraft's `entity` (kind
// already says todo/education_task/calendar_event vs. a people intent).
const SCHEMA: AiSchema = {
  type: 'object',
  required: ['drafts'],
  properties: {
    drafts: {
      type: 'array',
      description:
        'One entry per distinct actionable item or people-related statement found in the dump. Return one entry per item — never merge unrelated items into one, and never split a single item into two.',
      items: {
        type: 'object',
        required: ['kind'],
        properties: {
          kind: {
            type: 'string',
            enum: ['todo', 'education_task', 'calendar_event', 'new_person', 'update_person', 'log_interaction'],
            description:
              'todo: a general to-do. education_task: coursework/an assignment/essay. calendar_event: something happening at a specific time (usually implies a time of day). new_person: introduces someone not in the candidate list. update_person: new or changed info about someone already in the candidate list. log_interaction: describes something that happened — a conversation, meeting, or call.',
          },
          act: {
            type: 'object',
            nullable: true,
            description: 'Set only when kind is todo, education_task, or calendar_event.',
            required: ['title'],
            properties: {
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
          person_match: {
            type: 'object',
            nullable: true,
            description:
              'Set only when kind is update_person or log_interaction. The existing person this is about, chosen only from the candidate list below — never invent an id.',
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
              'Set only when kind is new_person or update_person. Leave a field null if the text does not mention it — never guess or invent a value.',
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
            description: 'Set only when kind is log_interaction.',
            required: ['summary'],
            properties: {
              summary: { type: 'string', description: 'Short summary of what happened.' },
              occurred_at: {
                type: 'string',
                nullable: true,
                description:
                  'ISO 8601 date or date-time, resolved against the current date/time given below, if the text implies a specific time. Null if unclear.',
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
      },
    },
  },
}

// A longer, mixed-intent dump is a harder extraction task than either of
// the single-intent calls this composes (lib/search/act.ts,
// lib/people/nl-extract.ts), so this deliberately spends more per call
// (smart tier, larger output budget) in exchange for handling many items
// in one call instead of one call per item.
export async function extractBrainDump(
  text: string,
  candidates: PersonCandidate[],
  referenceNow: string
): Promise<BrainDumpExtractResult> {
  const candidateList = candidates.map((c) => `${c.id}: ${c.full_name}`).join('\n') || '(none yet)'

  const prompt = `You extract multiple distinct actionable items and people-related statements from a longer free-text daily brain dump typed into a personal dashboard.

Current date/time: ${referenceNow}

Existing people (id: name) — match against these only, never invent an id:
${candidateList}

A single sentence often contains more than one item. Split on "and", "also", "then", semicolons, and separate clauses whenever each part could stand on its own as a distinct todo/task/event/person update — do not fold multiple unrelated actions into one title just because they were typed in one sentence.

Example: "Email the professor about the extension and pick up the dry cleaning before 6" is two unrelated todos, not one — extract two separate drafts with their own titles ("Email professor about extension", "Pick up dry cleaning"), not a single combined one.

Dump: "${text}"

Break the dump into as many separate items as it actually contains — a todo, a task, an event, a new person, an update about an existing person, and a logged conversation can all appear in the same dump. Extract each independently. Never guess a field that isn't stated or clearly implied. If the dump contains nothing actionable, return an empty drafts array.`

  return generateStructured<BrainDumpExtractResult>({
    prompt,
    schema: SCHEMA,
    feature: 'brain_dump',
    tier: 'smart',
    maxOutputTokens: 2000,
    // Splitting compound sentences into distinct items is a judgement
    // call, not pure extraction — worth paying for reasoning here (see
    // the thinking-budget rationale in lib/ai/gemini.ts).
    thinking: true,
  })
}
