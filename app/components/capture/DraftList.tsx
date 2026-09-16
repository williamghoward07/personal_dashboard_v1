'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { CheckCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Interaction, Person, Place } from '@/lib/types'
import type { DraftStore } from '@/lib/braindump/store'
import type { BrainDumpDraft, LocalDraft } from '@/lib/braindump/types'
import { isActKind } from '@/lib/braindump/types'
import type { ActDraft } from '@/lib/search/act-types'
import type { NlExtractedPerson } from '@/lib/people/nl-extract'
import PersonFormModal from '../widgets/people/PersonFormModal'
import type { PersonFormValues } from '../widgets/people/PersonFormModal'
import InteractionFormModal from '../widgets/people/InteractionFormModal'
import type { InteractionFormValues } from '../widgets/people/InteractionFormModal'
import type { PlaceFormValues } from '../widgets/people/PlaceFormModal'
import { insertFollowUpsForInteraction } from '../widgets/people/shared'
import DraftCard, { DRAFT_TONES, draftProblem, type DraftTone } from './DraftCard'

// Same threshold QuickAddBar uses — below this, a candidate match is
// treated as no match at all rather than guessing wrong.
const MATCH_CONFIDENCE_THRESHOLD = 0.6

type PendingReview =
  | { kind: 'person'; clientId: string; matchedPerson: Person | null; initialValues: Partial<Person> }
  | {
      kind: 'interaction'
      clientId: string
      initialValues: Partial<Interaction> & { follow_up?: string | null }
      initialPersonIds: string[]
    }

function nlPersonToPartial(extracted: NlExtractedPerson | null): Partial<Person> {
  if (!extracted) return {}
  return {
    full_name: extracted.full_name ?? undefined,
    email: extracted.email ?? undefined,
    phone: extracted.phone ?? undefined,
    company: extracted.company ?? undefined,
    job_title: extracted.job_title ?? undefined,
    how_we_met: extracted.how_we_met ?? undefined,
    notes: extracted.notes ?? undefined,
    tags: extracted.tags ?? undefined,
  }
}

function mergeExtractedPerson(existing: Person, extracted: NlExtractedPerson | null): Partial<Person> {
  if (!extracted) return existing
  return {
    ...existing,
    full_name: extracted.full_name ?? existing.full_name,
    email: extracted.email ?? existing.email,
    phone: extracted.phone ?? existing.phone,
    company: extracted.company ?? existing.company,
    job_title: extracted.job_title ?? existing.job_title,
    how_we_met: extracted.how_we_met ?? existing.how_we_met,
    notes: extracted.notes ?? existing.notes,
    tags: extracted.tags ?? existing.tags,
  }
}

function toActPayload(draft: LocalDraft): ActDraft | null {
  if (!draft.act || !isActKind(draft.kind)) return null
  return {
    entity: draft.kind,
    title: draft.act.title.trim(),
    due_date: draft.act.due_date,
    due_time: draft.act.due_time,
    notes: draft.act.notes,
  }
}

async function saveActDraft(draft: LocalDraft): Promise<string | null> {
  const payload = toActPayload(draft)
  if (!payload) return 'Nothing to save.'
  try {
    const res = await fetch('/api/capture/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: payload }),
    })
    if (res.ok) return null
    const body = await res.json().catch(() => null)
    return body?.message ?? body?.error ?? "Couldn't create that."
  } catch {
    return "Couldn't reach the server — try again in a moment."
  }
}

const needsPeopleData = (d: LocalDraft) => d.status === 'pending' && !isActKind(d.kind)

// Review list for extracted drafts (Brain Dump page and the home query
// box's Capture mode). Nothing is saved without a click: Confirm per
// draft, or "Confirm all" for the one-click kinds. People drafts always
// open their form.
export default function DraftList({
  store,
  tone,
  gridClassName = 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3',
  onSaved,
}: {
  store: DraftStore
  tone: DraftTone
  gridClassName?: string
  onSaved?: () => void
}) {
  const { drafts } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set())
  const [confirmingAll, setConfirmingAll] = useState(false)
  const [pending, setPending] = useState<PendingReview | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [places, setPlaces] = useState<Place[]>([])

  // Only fetched once a people draft actually shows up.
  const wantsPeople = drafts.some(needsPeopleData)
  const refreshPeople = () => {
    Promise.all([
      supabase.from('people').select('*').order('full_name', { ascending: true }),
      supabase.from('places').select('*').order('name', { ascending: true }),
    ]).then(([peopleRes, placesRes]) => {
      setPeople(peopleRes.data ?? [])
      setPlaces(placesRes.data ?? [])
    })
  }
  useEffect(() => {
    if (wantsPeople) refreshPeople()
  }, [wantsPeople])

  const setBusy = (clientId: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev)
      if (busy) next.add(clientId)
      else next.delete(clientId)
      return next
    })

  const findMatch = (draft: BrainDumpDraft): Person | null => {
    if (!draft.person_match || draft.person_match.confidence < MATCH_CONFIDENCE_THRESHOLD) return null
    return people.find((p) => p.id === draft.person_match!.id) ?? null
  }

  const confirmOne = async (draft: LocalDraft): Promise<boolean> => {
    if (draftProblem(draft)) return false
    setBusy(draft.clientId, true)
    const failure = await saveActDraft(draft)
    setBusy(draft.clientId, false)
    if (failure) {
      store.setError(failure)
      return false
    }
    store.setDraftStatus(draft.clientId, 'accepted')
    onSaved?.()
    return true
  }

  const quickDrafts = drafts.filter((d) => d.status === 'pending' && isActKind(d.kind) && !draftProblem(d))

  const confirmAll = async () => {
    setConfirmingAll(true)
    store.setError(null)
    let failed = 0
    // One at a time: calendar writes share a Google token refresh, and a
    // failure should leave the rest untouched and visible.
    for (const draft of quickDrafts) {
      if (!(await confirmOne(draft))) failed++
    }
    if (failed > 0) store.setError(`${failed} item${failed === 1 ? '' : 's'} couldn't be added — see the cards still open.`)
    setConfirmingAll(false)
  }

  const openReview = (draft: LocalDraft) => {
    if (draft.kind === 'log_interaction') {
      const matched = findMatch(draft)
      setPending({
        kind: 'interaction',
        clientId: draft.clientId,
        initialValues: {
          summary: draft.interaction?.summary ?? '',
          occurred_at: draft.interaction?.occurred_at ?? undefined,
          channel: draft.interaction?.channel ?? 'in_person',
          follow_up: draft.interaction?.follow_up ?? null,
        },
        initialPersonIds: matched ? [matched.id] : [],
      })
      return
    }

    if (draft.kind === 'update_person') {
      const matched = findMatch(draft)
      setPending({
        kind: 'person',
        clientId: draft.clientId,
        matchedPerson: matched,
        initialValues: matched ? mergeExtractedPerson(matched, draft.person) : nlPersonToPartial(draft.person),
      })
      return
    }

    if (draft.kind === 'new_person') {
      setPending({
        kind: 'person',
        clientId: draft.clientId,
        matchedPerson: null,
        initialValues: nlPersonToPartial(draft.person),
      })
    }
  }

  const savePerson = async (values: PersonFormValues) => {
    if (pending?.kind !== 'person') return
    const { error: dbError } = pending.matchedPerson
      ? await supabase
          .from('people')
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq('id', pending.matchedPerson.id)
      : await supabase.from('people').insert(values)

    if (dbError) {
      store.setError(`Couldn't save: ${dbError.message}`)
      return
    }
    store.setDraftStatus(pending.clientId, 'accepted')
    setPending(null)
    refreshPeople()
    onSaved?.()
  }

  const saveInteraction = async (values: InteractionFormValues) => {
    if (pending?.kind !== 'interaction') return
    const { data, error: insertError } = await supabase
      .from('interactions')
      .insert({
        occurred_at: values.occurred_at,
        title: values.title,
        summary: values.summary,
        channel: values.channel,
        place_id: values.place_id,
      })
      .select('id')
      .single()

    if (insertError || !data) {
      store.setError(`Couldn't save: ${insertError?.message ?? 'unknown error'}`)
      return
    }

    if (values.personIds.length > 0) {
      const { error: linkError } = await supabase
        .from('interaction_people')
        .insert(values.personIds.map((personId) => ({ interaction_id: data.id, person_id: personId })))
      if (linkError) {
        store.setError(`Couldn't link attendees: ${linkError.message}`)
        return
      }
    }

    const { error: followUpError } = await insertFollowUpsForInteraction(data.id, values.personIds, values.follow_up)
    if (followUpError) {
      store.setError(`Couldn't save follow-up: ${followUpError.message}`)
      return
    }

    store.setDraftStatus(pending.clientId, 'accepted')
    setPending(null)
    onSaved?.()
  }

  const createPlace = async (values: PlaceFormValues) => {
    const { data, error: insertError } = await supabase.from('places').insert(values).select().single()
    if (insertError || !data) {
      store.setError(`Couldn't create place: ${insertError?.message ?? 'unknown error'}`)
      return null
    }
    refreshPeople()
    return data
  }

  if (drafts.length === 0) return null

  const pendingCount = drafts.filter((d) => d.status === 'pending').length
  const finishedCount = drafts.length - pendingCount
  const t = DRAFT_TONES[tone]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-on-surface-variant">
          {pendingCount > 0
            ? `${pendingCount} to review — nothing is saved until you confirm.`
            : 'All reviewed.'}
        </p>
        <div className="flex items-center gap-2">
          {finishedCount > 0 && (
            <button
              type="button"
              onClick={store.clearFinished}
              className="rounded-md px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            >
              Clear done
            </button>
          )}
          {quickDrafts.length > 1 && (
            <button
              type="button"
              disabled={confirmingAll}
              onClick={confirmAll}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-surface disabled:opacity-60 ${t.solid}`}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {confirmingAll ? 'Adding…' : `Confirm all (${quickDrafts.length})`}
            </button>
          )}
        </div>
      </div>

      <div className={gridClassName}>
        {drafts.map((draft) => (
          <DraftCard
            key={draft.clientId}
            draft={draft}
            tone={tone}
            matchedPersonName={findMatch(draft)?.full_name ?? null}
            busy={busyIds.has(draft.clientId) || confirmingAll}
            onConfirm={() => void confirmOne(draft)}
            onReview={() => openReview(draft)}
            onDismiss={() => store.setDraftStatus(draft.clientId, 'rejected')}
            onEdit={(patch) => store.updateDraftAct(draft.clientId, patch)}
          />
        ))}
      </div>

      <PersonFormModal
        isOpen={pending?.kind === 'person'}
        heading={
          pending?.kind === 'person' && pending.matchedPerson ? `Update ${pending.matchedPerson.full_name}` : 'New person'
        }
        initialValues={pending?.kind === 'person' ? pending.initialValues : null}
        onClose={() => setPending(null)}
        onSave={savePerson}
      />

      <InteractionFormModal
        isOpen={pending?.kind === 'interaction'}
        heading="Log a conversation"
        people={people}
        places={places}
        initialValues={pending?.kind === 'interaction' ? pending.initialValues : null}
        initialPersonIds={pending?.kind === 'interaction' ? pending.initialPersonIds : []}
        onCreatePlace={createPlace}
        onClose={() => setPending(null)}
        onSave={saveInteraction}
      />
    </div>
  )
}
