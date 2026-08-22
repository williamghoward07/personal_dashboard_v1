'use client'

import { useState } from 'react'
import type { ComponentProps } from 'react'
import { MapPin, MessagesSquare, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { FollowUp, Interaction, InteractionPerson, Person, Place } from '@/lib/types'
import WidgetCard from '../../WidgetCard'
import ConfirmDialog from '../../ConfirmDialog'
import InteractionFormModal from './InteractionFormModal'
import type { InteractionFormValues } from './InteractionFormModal'
import type { RunMutation } from './shared'
import { attendeeNames, channelLabel, formatDate, insertFollowUpsForInteraction } from './shared'

export default function InteractionsCard({
  people,
  places,
  interactions,
  links,
  followUps,
  loading,
  runMutation,
  onChange,
}: {
  people: Person[]
  places: Place[]
  interactions: Interaction[]
  links: InteractionPerson[]
  followUps: FollowUp[]
  loading: boolean
  runMutation: RunMutation
  onChange: () => void
}) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editing, setEditing] = useState<Interaction | null>(null)
  const [deleting, setDeleting] = useState<Interaction | null>(null)

  const placeById = new Map(places.map((p) => [p.id, p]))

  /**
   * Replaces the attendee rows for an interaction. Delete-then-insert is simpler
   * than diffing and the row counts here are tiny.
   */
  const syncAttendees = async (interactionId: string, personIds: string[]) => {
    const cleared = await runMutation(() =>
      supabase.from('interaction_people').delete().eq('interaction_id', interactionId),
    )
    if (!cleared || personIds.length === 0) return cleared
    return runMutation(() =>
      supabase
        .from('interaction_people')
        .insert(personIds.map((personId) => ({ interaction_id: interactionId, person_id: personId }))),
    )
  }

  const toRow = (values: InteractionFormValues) => ({
    occurred_at: values.occurred_at,
    title: values.title,
    summary: values.summary,
    channel: values.channel,
    place_id: values.place_id,
  })

  /**
   * Reconciles an edited interaction's "bring up next time" note against
   * its follow_ups rows — updates the note for attendees who already had
   * one (preserving their completed state), adds rows for newly-added
   * attendees, and drops rows for attendees removed from the interaction
   * or once the note is cleared entirely.
   */
  const syncInteractionFollowUp = async (interactionId: string, personIds: string[], note: string | null) => {
    const { data: existing } = await supabase
      .from('follow_ups')
      .select('id, person_id')
      .eq('interaction_id', interactionId)
    const existingByPerson = new Map((existing ?? []).map((f) => [f.person_id, f.id]))
    const wanted = note ? personIds : []

    const stale = (existing ?? []).filter((f) => !wanted.includes(f.person_id)).map((f) => f.id)
    if (stale.length > 0) {
      const ok = await runMutation(() => supabase.from('follow_ups').delete().in('id', stale))
      if (!ok) return false
    }

    for (const personId of wanted) {
      const existingId = existingByPerson.get(personId)
      const ok = await runMutation(() =>
        existingId
          ? supabase.from('follow_ups').update({ note }).eq('id', existingId)
          : supabase.from('follow_ups').insert({ interaction_id: interactionId, person_id: personId, note }),
      )
      if (!ok) return false
    }
    return true
  }

  /** Inline "new place" escape hatch for the interaction form's place dropdown. */
  const createPlace: ComponentProps<typeof InteractionFormModal>['onCreatePlace'] = async (
    values,
  ) => {
    const { data, error } = await supabase.from('places').insert(values).select().single()
    if (error || !data) {
      await runMutation(() => Promise.resolve({ error }))
      return null
    }
    onChange()
    return data
  }

  return (
    <>
      <WidgetCard
        title="Conversations"
        accent="amber"
        icon={<MessagesSquare className="h-4 w-4" />}
        className="sm:col-span-2 xl:col-span-2"
        action={
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            aria-label="Log interaction"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-people-amber"
          >
            <Plus className="h-4 w-4" />
          </button>
        }
      >
        {loading ? (
          <p>Loading...</p>
        ) : interactions.length === 0 ? (
          <p>No conversations logged yet — add one to start building the history.</p>
        ) : (
          <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {interactions.map((interaction) => {
              const who = attendeeNames(interaction.id, links, people)
              const place = interaction.place_id ? placeById.get(interaction.place_id) : undefined
              return (
                <li
                  key={interaction.id}
                  className="rounded-lg border border-outline-variant p-2 hover:border-people-amber/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-on-surface">
                        {interaction.title || channelLabel(interaction.channel)}
                      </p>
                      <p className="truncate text-xs text-on-surface-variant">
                        {who || 'No one linked'}
                        {place && (
                          <>
                            {' · '}
                            <MapPin className="inline h-3 w-3" /> {place.name}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-xs text-on-surface-variant">
                        {formatDate(interaction.occurred_at)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditing(interaction)}
                        aria-label={`Edit interaction on ${formatDate(interaction.occurred_at)}`}
                        className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(interaction)}
                        aria-label={`Delete interaction on ${formatDate(interaction.occurred_at)}`}
                        className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {interaction.summary && (
                    <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">
                      {interaction.summary}
                    </p>
                  )}
                  {(() => {
                    const openNote = followUps.find(
                      (f) => f.interaction_id === interaction.id && f.completed_at === null,
                    )
                    return (
                      openNote && (
                        <p className="mt-1 truncate text-xs text-people-amber">
                          Next time: {openNote.note}
                        </p>
                      )
                    )
                  })()}
                </li>
              )
            })}
          </ul>
        )}
      </WidgetCard>

      <InteractionFormModal
        isOpen={isAddOpen}
        heading="Log a conversation"
        people={people}
        places={places}
        onCreatePlace={createPlace}
        onClose={() => setIsAddOpen(false)}
        onSave={async (values) => {
          const { data, error } = await supabase
            .from('interactions')
            .insert(toRow(values))
            .select('id')
            .single()
          if (error || !data) {
            await runMutation(() => Promise.resolve({ error }))
            return
          }
          await syncAttendees(data.id, values.personIds)
          await runMutation(() => insertFollowUpsForInteraction(data.id, values.personIds, values.follow_up))
          setIsAddOpen(false)
          onChange()
        }}
      />

      <InteractionFormModal
        isOpen={editing !== null}
        heading="Edit conversation"
        people={people}
        places={places}
        initialValues={
          editing
            ? { ...editing, follow_up: followUps.find((f) => f.interaction_id === editing.id)?.note ?? null }
            : null
        }
        initialPersonIds={
          editing
            ? links.filter((l) => l.interaction_id === editing.id).map((l) => l.person_id)
            : []
        }
        onCreatePlace={createPlace}
        onClose={() => setEditing(null)}
        onSave={async (values) => {
          if (!editing) return
          const ok = await runMutation(() =>
            supabase.from('interactions').update(toRow(values)).eq('id', editing.id),
          )
          if (!ok) return
          await syncAttendees(editing.id, values.personIds)
          await syncInteractionFollowUp(editing.id, values.personIds, values.follow_up)
          setEditing(null)
          onChange()
        }}
      />

      <ConfirmDialog
        isOpen={deleting !== null}
        message={`Delete this conversation${
          deleting ? ` from ${formatDate(deleting.occurred_at)}` : ''
        }? This can't be undone.`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          const ok = await runMutation(() =>
            supabase.from('interactions').delete().eq('id', deleting.id),
          )
          if (ok) {
            setDeleting(null)
            onChange()
          }
        }}
      />
    </>
  )
}
