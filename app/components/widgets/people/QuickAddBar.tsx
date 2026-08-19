'use client'

import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Sparkles, Send, Square } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Interaction, Person, Place } from '@/lib/types'
import type { NlExtractResult, NlExtractedPerson } from '@/lib/people/nl-extract'
import WidgetCard from '../../WidgetCard'
import PersonFormModal from './PersonFormModal'
import type { PersonFormValues } from './PersonFormModal'
import InteractionFormModal from './InteractionFormModal'
import type { InteractionFormValues } from './InteractionFormModal'
import type { PlaceFormValues } from './PlaceFormModal'
import type { RunMutation } from './shared'

// Below this, a candidate match is treated the same as no match at all —
// the form opens blank rather than guessing wrong. Disambiguation is
// always left to a human; this never auto-commits to a specific person.
const MATCH_CONFIDENCE_THRESHOLD = 0.6

type PendingAction =
  | { kind: 'person'; matchedPerson: Person | null; initialValues: Partial<Person> }
  | { kind: 'interaction'; initialValues: Partial<Interaction>; initialPersonIds: string[] }

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

// For a brand-new person there's no existing record to fall back to, so
// (unlike mergeExtractedPerson above) a missing field has to become
// undefined rather than null — Partial<Person>'s non-nullable fields
// (full_name) don't accept an explicit null the way the DB's nullable
// columns do.
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

// Write action, separate from AiQueryBar's home-page search — conflating
// the two would mean guessing whether ambiguous input ("had coffee with
// Alice today") is a search or a data-entry statement. Owns its own
// PersonFormModal/InteractionFormModal instances rather than sharing
// state with the Directory/Conversations cards, but still writes through
// the same people/places/runMutation/onChange props every other card on
// this page receives, so a save here shows up everywhere else too.
export default function QuickAddBar({
  people,
  places,
  runMutation,
  onChange,
  pushToGoogle,
}: {
  people: Person[]
  places: Place[]
  runMutation: RunMutation
  onChange: () => void
  pushToGoogle: (personId: string) => void
}) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/people/nl-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? "Couldn't understand that — try rephrasing, or add it manually below.")
        return
      }

      const result = (await res.json()) as NlExtractResult
      const matched =
        result.person_match && result.person_match.confidence >= MATCH_CONFIDENCE_THRESHOLD
          ? (people.find((p) => p.id === result.person_match!.id) ?? null)
          : null

      if (result.intent === 'log_interaction') {
        setPending({
          kind: 'interaction',
          initialValues: {
            summary: result.interaction?.summary ?? '',
            occurred_at: result.interaction?.occurred_at ?? undefined,
            channel: result.interaction?.channel ?? 'in_person',
            follow_up: result.interaction?.follow_up ?? null,
          },
          initialPersonIds: matched ? [matched.id] : [],
        })
      } else if (result.intent === 'update_person' && matched) {
        setPending({ kind: 'person', matchedPerson: matched, initialValues: mergeExtractedPerson(matched, result.person) })
      } else {
        setPending({ kind: 'person', matchedPerson: null, initialValues: nlPersonToPartial(result.person) })
      }

      setText('')
    } catch (err) {
      // Aborted by the stop button — reset quietly, this isn't an error.
      // Note this only stops the client from waiting: the route handler and
      // its Gemini call keep running server-side, the result is just
      // discarded here.
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError("Couldn't reach the AI service — try again in a moment, or add it manually below.")
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const handleStop = () => abortRef.current?.abort()

  const savePerson = async (values: PersonFormValues) => {
    if (pending?.kind !== 'person') return
    const ok = pending.matchedPerson
      ? await runMutation(() =>
          supabase
            .from('people')
            .update({ ...values, updated_at: new Date().toISOString() })
            .eq('id', pending.matchedPerson!.id),
        )
      : await runMutation(() => supabase.from('people').insert(values))
    if (ok) {
      if (pending.matchedPerson?.google_resource_name) pushToGoogle(pending.matchedPerson.id)
      setPending(null)
      onChange()
    }
  }

  const saveInteraction = async (values: InteractionFormValues) => {
    const { data, error: insertError } = await supabase
      .from('interactions')
      .insert({
        occurred_at: values.occurred_at,
        title: values.title,
        summary: values.summary,
        channel: values.channel,
        place_id: values.place_id,
        follow_up: values.follow_up,
      })
      .select('id')
      .single()

    if (insertError || !data) {
      await runMutation(() => Promise.resolve({ error: insertError }))
      return
    }

    if (values.personIds.length > 0) {
      const ok = await runMutation(() =>
        supabase
          .from('interaction_people')
          .insert(values.personIds.map((personId) => ({ interaction_id: data.id, person_id: personId }))),
      )
      if (!ok) return
    }

    setPending(null)
    onChange()
  }

  const createPlace = async (values: PlaceFormValues) => {
    const { data, error: insertError } = await supabase.from('places').insert(values).select().single()
    if (insertError || !data) {
      await runMutation(() => Promise.resolve({ error: insertError }))
      return null
    }
    onChange()
    return data
  }

  return (
    <>
      <WidgetCard
        title="Quick add"
        icon={<Sparkles className="h-4 w-4" />}
        accent="amber"
        className="sm:col-span-2 xl:col-span-4"
      >
        <div className={`relative rounded-lg ${loading ? 'rainbow-ring' : ''}`}>
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Had coffee with Alice, she just started at Deloitte..."
              disabled={loading}
              aria-label="Describe a person or something that happened"
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-people-amber disabled:opacity-60"
            />
            {loading ? (
              <button
                type="button"
                onClick={handleStop}
                aria-label="Stop"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-people-amber hover:bg-surface-container-high"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!text.trim()}
                aria-label="Extract"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-people-amber hover:bg-surface-container-high disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </form>
        </div>
        {loading && <p className="mt-2 text-xs text-on-surface-variant">Reading that…</p>}
        {error && <p className="mt-2 text-xs text-error">{error}</p>}
      </WidgetCard>

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
    </>
  )
}
