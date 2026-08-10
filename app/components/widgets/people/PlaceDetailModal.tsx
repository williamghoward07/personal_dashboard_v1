'use client'

import { ExternalLink, MapPin, Pencil, Trash2 } from 'lucide-react'
import Modal from '../../Modal'
import PersonAvatar from './PersonAvatar'
import type { Interaction, InteractionPerson, Person, Place } from '@/lib/types'
import { mapUrl, placeCategoryLabel } from '@/lib/places'
import { channelLabel, formatDate, peopleForInteraction } from './shared'

/** A tailored view of one place: who you've met there, and what was said. */
export default function PlaceDetailModal({
  place,
  people,
  interactions,
  links,
  onEdit,
  onDelete,
  onClose,
}: {
  place: Place | null
  people: Person[]
  interactions: Interaction[]
  links: InteractionPerson[]
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  if (!place) return null

  const here = interactions.filter((i) => i.place_id === place.id)

  const metHere: Person[] = []
  for (const interaction of here) {
    for (const person of peopleForInteraction(interaction.id, links, people)) {
      if (!metHere.some((p) => p.id === person.id)) metHere.push(person)
    }
  }

  const href = mapUrl(place)

  return (
    <Modal onClose={onClose}>
      <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-headline-md text-on-surface">{place.name}</h2>
            <span className="mt-1 inline-block rounded-full border border-people-amber/30 bg-people-amber/10 px-2 py-0.5 text-[10px] text-people-amber">
              {placeCategoryLabel(place.category)}
            </span>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${place.name}`}
              className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${place.name}`}
              className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {place.address && (
          <p className="flex items-start gap-2 text-sm text-on-surface-variant">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {place.address}
          </p>
        )}

        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="flex w-fit items-center gap-1.5 rounded-lg border border-outline-variant px-2 py-1 text-xs text-on-surface-variant hover:border-people-amber/50 hover:text-people-amber"
          >
            <ExternalLink className="h-3 w-3" />
            Open in Google Maps
          </a>
        )}

        {place.notes && (
          <p className="whitespace-pre-wrap text-sm text-on-surface-variant">{place.notes}</p>
        )}

        <section className="flex flex-col gap-1.5">
          <h3 className="font-display text-xs font-semibold text-on-surface">
            People you&apos;ve met here ({metHere.length})
          </h3>
          {metHere.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No one linked to this place yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {metHere.map((person) => (
                <li key={person.id} className="flex items-center gap-2">
                  <PersonAvatar fullName={person.full_name} photoUrl={person.photo_url} />
                  <span className="truncate text-sm text-on-surface">{person.full_name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-1.5">
          <h3 className="font-display text-xs font-semibold text-on-surface">
            Conversations here ({here.length})
          </h3>
          {here.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Nothing logged at this place yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {here.map((interaction) => (
                <li
                  key={interaction.id}
                  className="rounded-lg border border-outline-variant bg-surface-container-low p-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-on-surface">
                      {interaction.title || channelLabel(interaction.channel)}
                    </span>
                    <span className="shrink-0 text-xs text-on-surface-variant">
                      {formatDate(interaction.occurred_at)}
                    </span>
                  </div>
                  {interaction.summary && (
                    <p className="mt-1 line-clamp-3 text-xs text-on-surface-variant">
                      {interaction.summary}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  )
}
