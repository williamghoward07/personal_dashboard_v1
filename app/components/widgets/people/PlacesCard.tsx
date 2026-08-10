'use client'

import { useState } from 'react'
import { MapPin, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Interaction, InteractionPerson, Person, Place } from '@/lib/types'
import WidgetCard from '../../WidgetCard'
import ConfirmDialog from '../../ConfirmDialog'
import PlaceFormModal from './PlaceFormModal'
import PlaceDetailModal from './PlaceDetailModal'
import type { RunMutation } from './shared'
import { peopleForInteraction } from './shared'

export default function PlacesCard({
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
  const [viewing, setViewing] = useState<Place | null>(null)
  const [editing, setEditing] = useState<Place | null>(null)
  const [deleting, setDeleting] = useState<Place | null>(null)

  /** Distinct people met at a place, for the row's count badge. */
  const peopleCountAt = (placeId: string) => {
    const seen = new Set<string>()
    for (const interaction of interactions.filter((i) => i.place_id === placeId)) {
      for (const person of peopleForInteraction(interaction.id, links, people)) {
        seen.add(person.id)
      }
    }
    return seen.size
  }

  const viewingFresh = viewing ? (places.find((p) => p.id === viewing.id) ?? null) : null

  return (
    <>
      <WidgetCard
        title="Places"
        accent="amber"
        icon={<MapPin className="h-4 w-4" />}
        className="sm:col-span-2 xl:col-span-1"
        action={
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            aria-label="Add place"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-people-amber"
          >
            <Plus className="h-4 w-4" />
          </button>
        }
      >
        {loading ? (
          <p>Loading...</p>
        ) : places.length === 0 ? (
          <p>No places yet — add one so conversations can be anchored to where they happened.</p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {places.map((place) => {
              const count = peopleCountAt(place.id)
              return (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => setViewing(place)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-outline-variant p-2 text-left hover:border-people-amber/40"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-on-surface">
                      {place.name}
                    </span>
                    <span className="shrink-0 text-xs text-on-surface-variant">
                      {count === 0 ? '—' : `${count}`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </WidgetCard>

      <PlaceDetailModal
        place={viewingFresh}
        people={people}
        interactions={interactions}
        links={links}
        onEdit={() => {
          setEditing(viewingFresh)
          setViewing(null)
        }}
        onDelete={() => {
          setDeleting(viewingFresh)
          setViewing(null)
        }}
        onClose={() => setViewing(null)}
      />

      <PlaceFormModal
        isOpen={isAddOpen}
        heading="New place"
        onClose={() => setIsAddOpen(false)}
        onSave={async (values) => {
          const ok = await runMutation(() => supabase.from('places').insert(values))
          if (ok) {
            setIsAddOpen(false)
            onChange()
          }
        }}
      />

      <PlaceFormModal
        isOpen={editing !== null}
        heading="Edit place"
        initialValues={editing}
        onClose={() => setEditing(null)}
        onSave={async (values) => {
          if (!editing) return
          const ok = await runMutation(() =>
            supabase.from('places').update(values).eq('id', editing.id),
          )
          if (ok) {
            setEditing(null)
            onChange()
          }
        }}
      />

      <ConfirmDialog
        isOpen={deleting !== null}
        message={`Delete "${deleting?.name}"? Conversations logged there stay, but lose their location. This can't be undone.`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          const ok = await runMutation(() =>
            supabase.from('places').delete().eq('id', deleting.id),
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
