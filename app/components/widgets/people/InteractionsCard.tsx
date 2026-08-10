'use client'

import { useState } from 'react'
import { MapPin, MessagesSquare, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Interaction, InteractionPerson, Person, Place } from '@/lib/types'
import WidgetCard from '../../WidgetCard'
import ConfirmDialog from '../../ConfirmDialog'
import InteractionFormModal from './InteractionFormModal'
import type { InteractionFormValues } from './InteractionFormModal'
import type { RunMutation } from './shared'
import { attendeeNames, channelLabel, formatDate } from './shared'

export default function InteractionsCard({
  people,
  places,
  interactions,
  links,
  loading,
  runMutation,
  onChange,
}: {
  people: Person[]
  places: Place[]
  interactions: Interaction[]
  links: InteractionPerson[]
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
    follow_up: values.follow_up,
  })

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
                  {interaction.follow_up && !interaction.follow_up_done && (
                    <p className="mt-1 truncate text-xs text-people-amber">
                      Next time: {interaction.follow_up}
                    </p>
                  )}
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
          setIsAddOpen(false)
          onChange()
        }}
      />

      <InteractionFormModal
        isOpen={editing !== null}
        heading="Edit conversation"
        people={people}
        places={places}
        initialValues={editing}
        initialPersonIds={
          editing
            ? links.filter((l) => l.interaction_id === editing.id).map((l) => l.person_id)
            : []
        }
        onClose={() => setEditing(null)}
        onSave={async (values) => {
          if (!editing) return
          const ok = await runMutation(() =>
            supabase.from('interactions').update(toRow(values)).eq('id', editing.id),
          )
          if (!ok) return
          await syncAttendees(editing.id, values.personIds)
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
