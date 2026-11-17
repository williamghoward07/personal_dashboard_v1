'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
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
import styles from '../widgets/braindump/BrainDump.module.css'

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

const canConfirm = (draft: LocalDraft) =>
  draft.status === 'pending' && isActKind(draft.kind) && !draftProblem(draft)

const needsPeopleData = (d: LocalDraft) => d.status === 'pending' && !isActKind(d.kind)

// Review list for extracted drafts (Brain Dump page and the home query
// box's Capture mode). Nothing is saved without a click: Confirm per
// draft, or "Confirm all" for the one-click kinds. People drafts always
// open their form.
export default function DraftList({
  store,
  tone,
  reviewHeadingId,
  gridClassName = 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3',
  onSaved,
}: {
  store: DraftStore
  tone: DraftTone
  reviewHeadingId?: string
  gridClassName?: string
  onSaved?: () => void
}) {
  const { drafts, confirming } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const brainDump = Boolean(reviewHeadingId)
  const confirmingAll = confirming === 'all'
  const isSaving = confirming !== null
  const [pending, setPending] = useState<PendingReview | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const reviewTrigger = useRef<HTMLButtonElement>(null)
  const reviewHeading = useRef<HTMLHeadingElement>(null)
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

  useEffect(() => {
    const trigger = reviewTrigger.current
    if (pending || !trigger) return
    reviewTrigger.current = null
    if (trigger.isConnected) trigger.focus()
    else reviewHeading.current?.focus()
  }, [pending])

  const findMatch = (draft: BrainDumpDraft): Person | null => {
    if (!draft.person_match || draft.person_match.confidence < MATCH_CONFIDENCE_THRESHOLD) return null
    return people.find((p) => p.id === draft.person_match!.id) ?? null
  }

  const confirmDraft = async (draft: LocalDraft, focusFrom?: HTMLButtonElement) => {
    const error = await saveActDraft(draft)
    if (!error) {
      if (focusFrom && (document.activeElement === focusFrom || document.activeElement === document.body)) {
        reviewHeading.current?.focus()
      }
      store.setDraftStatus(draft.clientId, 'accepted')
      onSaved?.()
    }
    return error
  }

  const confirmOne = (draft: LocalDraft, trigger: HTMLButtonElement) => store.runConfirmation(draft.clientId, async () => {
    const current = store.getSnapshot().drafts.find((item) => item.clientId === draft.clientId)
    if (!current || !canConfirm(current)) return
    const failure = await confirmDraft(current, trigger)
    if (failure) store.setError(failure)
  })

  const pendingCount = drafts.filter((draft) => draft.status === 'pending').length
  const finishedCount = drafts.length - pendingCount
  const quickDrafts = drafts.filter(canConfirm)
  const reviewCount = pendingCount - quickDrafts.length

  const confirmAll = () => store.runConfirmation('all', async () => {
    const failures: string[] = []
    // Calendar writes share a Google token refresh. Keep the batch sequential.
    for (const draft of store.getSnapshot().drafts.filter(canConfirm)) {
      const failure = await confirmDraft(draft)
      if (failure) failures.push(failure)
    }
    if (failures.length) {
      const label = failures.length === 1 ? '1 item' : `${failures.length} items`
      store.setError(`${label} couldn’t be added. ${failures[0]}`)
    }
  })

  const openReview = (draft: LocalDraft, trigger: HTMLButtonElement) => {
    if (store.getSnapshot().confirming !== null) return
    if (brainDump) reviewTrigger.current = trigger
    setReviewError(null)
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

  const closeReview = () => {
    if (store.getSnapshot().confirming !== null) return
    setPending(null)
    setReviewError(null)
  }

  const saveReview = (clientId: string, save: () => Promise<string | null>) =>
    store.runConfirmation(clientId, async () => {
      setReviewError(null)
      try {
        const error = await save()
        if (error) {
          setReviewError(error)
          return
        }
        store.setDraftStatus(clientId, 'accepted')
        setPending(null)
        onSaved?.()
      } catch {
        setReviewError("Couldn't reach the server. Try again in a moment.")
      }
    })

  const savePerson = (values: PersonFormValues) => {
    if (pending?.kind !== 'person') return
    return saveReview(pending.clientId, async () => {
      const { error } = pending.matchedPerson
        ? await supabase
            .from('people')
            .update({ ...values, updated_at: new Date().toISOString() })
            .eq('id', pending.matchedPerson.id)
        : await supabase.from('people').insert(values)
      if (error) return `Couldn't save: ${error.message}`
      refreshPeople()
      return null
    })
  }

  const saveInteraction = (values: InteractionFormValues) => {
    if (pending?.kind !== 'interaction') return
    return saveReview(pending.clientId, async () => {
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
      if (insertError || !data) return `Couldn't save: ${insertError?.message ?? 'unknown error'}`

      if (values.personIds.length > 0) {
        const { error: linkError } = await supabase
          .from('interaction_people')
          .insert(values.personIds.map((personId) => ({ interaction_id: data.id, person_id: personId })))
        if (linkError) return `Couldn't link attendees: ${linkError.message}`
      }

      const { error: followUpError } = await insertFollowUpsForInteraction(data.id, values.personIds, values.follow_up)
      if (followUpError) return `Couldn't save follow-up: ${followUpError.message}`
      return null
    })
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

  if (!brainDump && drafts.length === 0) return null

  const t = DRAFT_TONES[tone]
  const cards = drafts.map((draft) => (
    <DraftCard
      key={draft.clientId}
      draft={draft}
      tone={tone}
      brainDump={brainDump}
      matchedPersonName={findMatch(draft)?.full_name ?? null}
      busy={isSaving}
      saving={confirming === draft.clientId || (confirmingAll && isActKind(draft.kind) && !draftProblem(draft))}
      onConfirm={(event) => void confirmOne(draft, event.currentTarget)}
      onReview={(event) => openReview(draft, event.currentTarget)}
      onDismiss={() => {
        if (store.getSnapshot().confirming !== null) return
        reviewHeading.current?.focus()
        store.setDraftStatus(draft.clientId, 'rejected')
      }}
      onEdit={(patch) => store.updateDraftAct(draft.clientId, patch)}
    />
  ))
  const dialogs = (
    <>
      <PersonFormModal
        isOpen={pending?.kind === 'person'}
        heading={
          pending?.kind === 'person' && pending.matchedPerson ? `Update ${pending.matchedPerson.full_name}` : 'New person'
        }
        initialValues={pending?.kind === 'person' ? pending.initialValues : null}
        saving={isSaving}
        saveError={reviewError}
        captureReview={brainDump}
        onClose={closeReview}
        onSave={savePerson}
      />

      <InteractionFormModal
        isOpen={pending?.kind === 'interaction'}
        heading="Log a conversation"
        people={people}
        places={places}
        initialValues={pending?.kind === 'interaction' ? pending.initialValues : null}
        initialPersonIds={pending?.kind === 'interaction' ? pending.initialPersonIds : undefined}
        saving={isSaving}
        saveError={reviewError}
        captureReview={brainDump}
        onCreatePlace={createPlace}
        onClose={closeReview}
        onSave={saveInteraction}
      />
    </>
  )

  if (brainDump) {
    return (
      <section className={styles.review} aria-labelledby={reviewHeadingId}>
        <header className={styles.reviewHeader}>
          <h2 ref={reviewHeading} id={reviewHeadingId} tabIndex={-1}>Review drafts</h2>
          <div className={styles.counts} role="status">
            {pendingCount > 0 ? (
              <>
                {quickDrafts.length > 0 && <span className={styles.readyBadge}>{quickDrafts.length} ready</span>}
                {reviewCount > 0 && <span className={styles.reviewBadge}>{reviewCount} {reviewCount === 1 ? 'needs' : 'need'} review</span>}
              </>
            ) : drafts.length > 0 && 'All reviewed'}
          </div>
        </header>
        {drafts.length > 0 ? (
          <ul className={styles.drafts} aria-label="Extracted drafts">{cards}</ul>
        ) : (
          <p className={styles.empty}>Extract items from your capture to review them here.</p>
        )}
        {(confirmingAll || quickDrafts.length > 1 || finishedCount > 0) && (
          <footer className={styles.reviewFooter}>
            {(confirmingAll || quickDrafts.length > 1) && (
              <button type="button" className={styles.primaryButton} disabled={isSaving} onClick={() => {
                reviewHeading.current?.focus()
                void confirmAll()
              }}>
                {confirmingAll ? 'Adding…' : `Confirm ${quickDrafts.length} ready items`}
              </button>
            )}
            {finishedCount > 0 && (
              <button type="button" className={styles.secondaryButton} onClick={() => {
                reviewHeading.current?.focus()
                store.clearFinished()
              }}>
                Clear done
              </button>
            )}
          </footer>
        )}
        {dialogs}
      </section>
    )
  }

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
              disabled={isSaving}
              onClick={confirmAll}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-surface disabled:opacity-60 ${t.solid}`}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {confirmingAll ? 'Adding…' : `Confirm all (${quickDrafts.length})`}
            </button>
          )}
        </div>
      </div>

      <div className={gridClassName}>{cards}</div>
      {dialogs}
    </div>
  )
}
