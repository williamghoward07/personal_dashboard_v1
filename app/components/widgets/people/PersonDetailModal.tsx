'use client'

import { useState } from 'react'
import { Cake, Building2, Link, Mail, MapPin, Pencil, Phone, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Modal from '../../Modal'
import ConfirmDialog from '../../ConfirmDialog'
import PersonAvatar from './PersonAvatar'
import FollowUpFormModal from './FollowUpFormModal'
import type { FollowUp, Interaction, InteractionPerson, Person, Place } from '@/lib/types'
import { mapUrl } from '@/lib/places'
import { channelLabel, formatDate, interactionsForPerson } from './shared'
import type { RunMutation } from './shared'

/**
 * A tailored view of one person: their contact card, what you know about them,
 * every conversation you've logged, and the places those happened.
 */
export default function PersonDetailModal({
  person,
  places,
  interactions,
  links,
  followUps,
  people,
  runMutation,
  onChange,
  onEdit,
  onDelete,
  onClose,
}: {
  person: Person | null
  places: Place[]
  interactions: Interaction[]
  links: InteractionPerson[]
  followUps: FollowUp[]
  people: Person[]
  runMutation: RunMutation
  onChange: () => void
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null)
  const [deletingFollowUp, setDeletingFollowUp] = useState<FollowUp | null>(null)

  if (!person) return null

  const theirs = interactionsForPerson(person.id, links, interactions)
  const placeById = new Map(places.map((p) => [p.id, p]))

  // Where you've actually met them, most-recent first, deduplicated.
  const metAt: Place[] = []
  for (const interaction of theirs) {
    if (!interaction.place_id) continue
    const place = placeById.get(interaction.place_id)
    if (place && !metAt.some((p) => p.id === place.id)) metAt.push(place)
  }

  const openFollowUps = followUps.filter((f) => f.person_id === person.id && f.completed_at === null)
  const closedFollowUps = followUps
    .filter((f) => f.person_id === person.id && f.completed_at !== null)
    .sort((a, b) => (b.completed_at as string).localeCompare(a.completed_at as string))

  return (
    <>
      <Modal onClose={onClose} size="lg">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <PersonAvatar fullName={person.full_name} photoUrl={person.photo_url} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-headline-md text-on-surface">{person.full_name}</h2>
              {(person.job_title || person.company) && (
                <p className="truncate text-sm text-on-surface-variant">
                  {[person.job_title, person.company].filter(Boolean).join(' · ')}
                </p>
              )}
              {person.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {person.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-people-amber/30 bg-people-amber/10 px-2 py-0.5 text-[10px] text-people-amber"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${person.full_name}`}
                className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label={`Delete ${person.full_name}`}
                className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {person.email && (
              <li className="flex items-center gap-2 text-on-surface-variant">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <a href={`mailto:${person.email}`} className="truncate hover:text-people-amber">
                  {person.email}
                </a>
              </li>
            )}
            {person.phone && (
              <li className="flex items-center gap-2 text-on-surface-variant">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <a href={`tel:${person.phone}`} className="truncate hover:text-people-amber">
                  {person.phone}
                </a>
              </li>
            )}
            {person.linkedin_url && (
              <li className="flex items-center gap-2 text-on-surface-variant">
                <Link className="h-3.5 w-3.5 shrink-0" />
                <a
                  href={person.linkedin_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="truncate hover:text-people-amber"
                >
                  LinkedIn profile
                </a>
              </li>
            )}
            {person.birthday && (
              <li className="flex items-center gap-2 text-on-surface-variant">
                <Cake className="h-3.5 w-3.5 shrink-0" />
                {formatDate(person.birthday)}
              </li>
            )}
            {person.how_we_met && (
              <li className="flex items-center gap-2 text-on-surface-variant">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                Met via {person.how_we_met}
              </li>
            )}
          </ul>

          {person.notes && (
            <section className="flex flex-col gap-1">
              <h3 className="font-display text-xs font-semibold text-on-surface">Notes</h3>
              <p className="whitespace-pre-wrap text-sm text-on-surface-variant">{person.notes}</p>
            </section>
          )}

          {openFollowUps.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="font-display text-xs font-semibold text-on-surface">
                Bring up next time
              </h3>
              <ul className="flex flex-col gap-1.5">
                {openFollowUps.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-start gap-2 rounded-lg border border-people-amber/30 bg-people-amber/5 px-2 py-1.5 text-xs text-on-surface"
                  >
                    <span className="min-w-0 flex-1">
                      {f.note}
                      {f.due_date && <span className="text-on-surface-variant"> · Due {formatDate(f.due_date)}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingFollowUp(f)}
                      aria-label={`Edit "${f.note}"`}
                      className="shrink-0 rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingFollowUp(f)}
                      aria-label={`Delete "${f.note}"`}
                      className="shrink-0 rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {closedFollowUps.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="font-display text-xs font-semibold text-on-surface">
                Previously brought up
              </h3>
              <ul className="flex flex-col gap-1.5">
                {closedFollowUps.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-start gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1.5 text-xs text-on-surface-variant"
                  >
                    <span className="min-w-0 flex-1">
                      {f.note}
                      {f.completed_at && <span> · {formatDate(f.completed_at)}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeletingFollowUp(f)}
                      aria-label={`Delete "${f.note}"`}
                      className="shrink-0 rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {metAt.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="font-display text-xs font-semibold text-on-surface">
                Places you&apos;ve met
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {metAt.map((place) => {
                  const href = mapUrl(place)
                  return href ? (
                    <a
                      key={place.id}
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-1 rounded-full border border-outline-variant px-2 py-0.5 text-xs text-on-surface-variant hover:border-people-amber/50 hover:text-people-amber"
                    >
                      <MapPin className="h-3 w-3" />
                      {place.name}
                    </a>
                  ) : (
                    <span
                      key={place.id}
                      className="flex items-center gap-1 rounded-full border border-outline-variant px-2 py-0.5 text-xs text-on-surface-variant"
                    >
                      <MapPin className="h-3 w-3" />
                      {place.name}
                    </span>
                  )
                })}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-1.5">
            <h3 className="font-display text-xs font-semibold text-on-surface">
              Conversations ({theirs.length})
            </h3>
            {theirs.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                Nothing logged yet — add an interaction to start their history.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {theirs.map((i) => {
                  const place = i.place_id ? placeById.get(i.place_id) : undefined
                  return (
                    <li
                      key={i.id}
                      className="rounded-lg border border-outline-variant bg-surface-container-low p-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium text-on-surface">
                          {i.title || channelLabel(i.channel)}
                        </span>
                        <span className="shrink-0 text-xs text-on-surface-variant">
                          {formatDate(i.occurred_at)}
                        </span>
                      </div>
                      {place && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-on-surface-variant">
                          <MapPin className="h-3 w-3" />
                          {place.name}
                        </p>
                      )}
                      {i.summary && (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-on-surface-variant">
                          {i.summary}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </Modal>

      <FollowUpFormModal
        isOpen={editingFollowUp !== null}
        heading="Edit follow-up"
        people={people}
        initialValues={editingFollowUp}
        onClose={() => setEditingFollowUp(null)}
        onSave={async (values) => {
          if (!editingFollowUp) return
          const ok = await runMutation(() =>
            supabase.from('follow_ups').update(values).eq('id', editingFollowUp.id),
          )
          if (ok) {
            setEditingFollowUp(null)
            onChange()
          }
        }}
      />

      <ConfirmDialog
        isOpen={deletingFollowUp !== null}
        message={`Delete "${deletingFollowUp?.note}"? This can't be undone.`}
        onCancel={() => setDeletingFollowUp(null)}
        onConfirm={async () => {
          if (!deletingFollowUp) return
          const ok = await runMutation(() => supabase.from('follow_ups').delete().eq('id', deletingFollowUp.id))
          if (ok) {
            setDeletingFollowUp(null)
            onChange()
          }
        }}
      />
    </>
  )
}
