'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Brain, Send, Square } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Interaction, Person, Place } from '@/lib/types'
import type { ActEntity } from '@/lib/search/act'
import type { BrainDumpDraft, BrainDumpExtractResult } from '@/lib/braindump/extract'
import type { NlExtractedPerson } from '@/lib/people/nl-extract'
import PersonFormModal from '../people/PersonFormModal'
import type { PersonFormValues } from '../people/PersonFormModal'
import InteractionFormModal from '../people/InteractionFormModal'
import type { InteractionFormValues } from '../people/InteractionFormModal'
import type { PlaceFormValues } from '../people/PlaceFormModal'
import { insertFollowUpsForInteraction } from '../people/shared'
import DraftCard from './DraftCard'
import type { LocalDraft } from './DraftCard'

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

// Reuses the exact write shape app/api/search/act/confirm expects —
// duplicated (not imported) because lib/search/act.ts is server-only and
// this is a client component; AiQueryBar.tsx does the same type-only
// import of ActEntity for the same reason.
function toActPayload(draft: LocalDraft): { entity: ActEntity; title: string; due_date: string | null; due_time: string | null; notes: string | null } | null {
  if (!draft.act) return null
  if (draft.kind !== 'todo' && draft.kind !== 'education_task' && draft.kind !== 'calendar_event') return null
  return {
    entity: draft.kind,
    title: draft.act.title,
    due_date: draft.act.due_date,
    due_time: draft.act.due_time,
    notes: draft.act.notes,
  }
}

export default function BrainDumpBoard() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<LocalDraft[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingReview | null>(null)

  const [people, setPeople] = useState<Person[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const refreshPeople = () => {
    Promise.all([
      supabase.from('people').select('*').order('full_name', { ascending: true }),
      supabase.from('places').select('*').order('name', { ascending: true }),
    ]).then(([peopleRes, placesRes]) => {
      setPeople(peopleRes.data ?? [])
      setPlaces(placesRes.data ?? [])
    })
  }

  useEffect(refreshPeople, [])

  const findMatch = (draft: BrainDumpDraft): Person | null => {
    if (!draft.person_match || draft.person_match.confidence < MATCH_CONFIDENCE_THRESHOLD) return null
    return people.find((p) => p.id === draft.person_match!.id) ?? null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/brain-dump/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? "Couldn't read that — try rephrasing.")
        return
      }

      const result = (await res.json()) as BrainDumpExtractResult
      if (result.drafts.length === 0) {
        setError("Didn't find anything actionable in that.")
        return
      }

      const newDrafts: LocalDraft[] = result.drafts.map((d, i) => ({
        ...d,
        clientId: `${Date.now()}-${i}`,
        status: 'pending',
      }))
      setDrafts((current) => [...newDrafts, ...current])
      setText('')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError("Couldn't reach the AI service — try again in a moment.")
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const handleStop = () => abortRef.current?.abort()

  const setDraftStatus = (clientId: string, status: LocalDraft['status']) => {
    setDrafts((current) => current.map((d) => (d.clientId === clientId ? { ...d, status } : d)))
  }

  const confirmAct = async (draft: LocalDraft) => {
    const payload = toActPayload(draft)
    if (!payload || !payload.title.trim()) return
    setBusyId(draft.clientId)
    setError(null)
    try {
      const res = await fetch('/api/search/act/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: payload }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? "Couldn't create that.")
        return
      }
      setDraftStatus(draft.clientId, 'accepted')
    } catch {
      setError("Couldn't reach the server — try again in a moment.")
    } finally {
      setBusyId(null)
    }
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
      ? await supabase.from('people').update({ ...values, updated_at: new Date().toISOString() }).eq('id', pending.matchedPerson.id)
      : await supabase.from('people').insert(values)

    if (dbError) {
      setError(`Couldn't save: ${dbError.message}`)
      return
    }
    setDraftStatus(pending.clientId, 'accepted')
    setPending(null)
    refreshPeople()
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
      setError(`Couldn't save: ${insertError?.message ?? 'unknown error'}`)
      return
    }

    if (values.personIds.length > 0) {
      const { error: linkError } = await supabase
        .from('interaction_people')
        .insert(values.personIds.map((personId) => ({ interaction_id: data.id, person_id: personId })))
      if (linkError) {
        setError(`Couldn't link attendees: ${linkError.message}`)
        return
      }
    }

    const { error: followUpError } = await insertFollowUpsForInteraction(data.id, values.personIds, values.follow_up)
    if (followUpError) {
      setError(`Couldn't save follow-up: ${followUpError.message}`)
      return
    }

    setDraftStatus(pending.clientId, 'accepted')
    setPending(null)
  }

  const createPlace = async (values: PlaceFormValues) => {
    const { data, error: insertError } = await supabase.from('places').insert(values).select().single()
    if (insertError || !data) {
      setError(`Couldn't create place: ${insertError?.message ?? 'unknown error'}`)
      return null
    }
    refreshPeople()
    return data
  }

  return (
    <div className="flex flex-col gap-4 sm:col-span-2 xl:col-span-4">
      <div className={`relative rounded-xl border border-outline-variant bg-surface-container-low p-4 ${loading ? 'rainbow-ring' : ''}`}>
        <div className="mb-3 flex items-center gap-2">
          <Brain className="h-4 w-4 text-habit-purple" />
          <h2 className="font-display text-sm font-semibold text-on-surface">Daily brain dump</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            disabled={loading}
            placeholder="Write out whatever's on your mind — todos, deadlines, people you talked to, things you need to remember. It'll be split into separate items below for you to review."
            aria-label="Daily brain dump"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-habit-purple disabled:opacity-60"
          />
          <div className="flex items-center justify-end gap-2">
            {loading ? (
              <button
                type="button"
                onClick={handleStop}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-habit-purple hover:bg-surface-container-high"
              >
                <Square className="h-3.5 w-3.5" />
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!text.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-habit-purple px-3 py-1.5 text-sm font-medium text-surface disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                Extract items
              </button>
            )}
          </div>
        </form>
        {loading && <p className="mt-1 text-xs text-on-surface-variant">Reading that…</p>}
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>

      {drafts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {drafts.map((draft) => (
            <DraftCard
              key={draft.clientId}
              draft={draft}
              matchedPersonName={findMatch(draft)?.full_name ?? null}
              busy={busyId === draft.clientId}
              onConfirmAct={() => confirmAct(draft)}
              onReview={() => openReview(draft)}
              onDismiss={() => setDraftStatus(draft.clientId, 'rejected')}
            />
          ))}
        </div>
      )}

      <PersonFormModal
        isOpen={pending?.kind === 'person'}
        heading={pending?.kind === 'person' && pending.matchedPerson ? `Update ${pending.matchedPerson.full_name}` : 'New person'}
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
