// Browser-safe draft types shared by the extractor (./extract, server-only),
// the draft stores (./store) and the capture UI (app/components/capture).

import type { ActEntity } from '@/lib/search/act-types'
import type { NlExtractedInteraction, NlExtractedPerson, NlPersonMatch } from '@/lib/people/nl-extract'

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

export interface LocalDraft extends BrainDumpDraft {
  clientId: string
  status: 'pending' | 'accepted' | 'rejected'
}

/** Kinds that save in one click via app/api/capture/confirm. */
export const ACT_KINDS: readonly ActEntity[] = ['todo', 'education_task', 'calendar_event']

export function isActKind(kind: BrainDumpDraftKind): kind is ActEntity {
  return (ACT_KINDS as readonly string[]).includes(kind)
}
