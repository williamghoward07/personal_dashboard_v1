'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Contact, Plus, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { FollowUp, Interaction, InteractionPerson, Person, Place } from '@/lib/types'
import WidgetCard from '../../WidgetCard'
import ConfirmDialog from '../../ConfirmDialog'
import PersonAvatar from './PersonAvatar'
import PersonFormModal from './PersonFormModal'
import PersonDetailModal from './PersonDetailModal'
import type { RunMutation } from './shared'
import { interactionsForPerson } from './shared'

export default function PeopleDirectoryCard({
  people,
  places,
  interactions,
  links,
  followUps,
  loading,
  runMutation,
  onChange,
  pushToGoogle,
}: {
  people: Person[]
  places: Place[]
  interactions: Interaction[]
  links: InteractionPerson[]
  followUps: FollowUp[]
  loading: boolean
  runMutation: RunMutation
  onChange: () => void
  pushToGoogle: (personId: string) => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [viewingPerson, setViewingPerson] = useState<Person | null>(null)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [deletingPerson, setDeletingPerson] = useState<Person | null>(null)

  // Deep-link support: a follow-up elsewhere in the app (home glance,
  // FollowUpsCard) links to /people?person=<id> so clicking it jumps
  // straight into that person's detail view instead of just the page.
  useEffect(() => {
    const personId = searchParams.get('person')
    if (!personId) return
    const match = people.find((p) => p.id === personId)
    if (match) setViewingPerson(match)
  }, [searchParams, people])

  const closeViewingPerson = () => {
    setViewingPerson(null)
    if (searchParams.get('person')) router.replace('/people', { scroll: false })
  }

  const allTags = useMemo(
    () => [...new Set(people.flatMap((p) => p.tags))].sort(),
    [people],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return people.filter((p) => {
      if (p.archived) return false
      if (activeTag && !p.tags.includes(activeTag)) return false
      if (!q) return true
      return [p.full_name, p.email, p.company, p.job_title, p.notes, p.how_we_met]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    })
  }, [people, query, activeTag])

  // Keep the modal showing fresh data after an edit.
  const viewing = viewingPerson ? (people.find((p) => p.id === viewingPerson.id) ?? null) : null

  return (
    <>
      <WidgetCard
        title="Directory"
        accent="amber"
        icon={<Contact className="h-4 w-4" />}
        className="sm:col-span-2 xl:col-span-2"
        action={
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            aria-label="Add person"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-people-amber"
          >
            <Plus className="h-4 w-4" />
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 focus-within:border-people-amber">
            <Search className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, company, notes..."
              aria-label="Search people"
              className="w-full bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
            />
          </label>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    activeTag === tag
                      ? 'border-people-amber/50 bg-people-amber/10 text-people-amber'
                      : 'border-outline-variant text-on-surface-variant hover:border-outline'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <p>Loading...</p>
          ) : filtered.length === 0 ? (
            <p>
              {people.length === 0
                ? 'No people yet — add someone, or connect Google Contacts to import them.'
                : 'No one matches that search.'}
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {filtered.map((person) => {
                const count = interactionsForPerson(person.id, links, interactions).length
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => setViewingPerson(person)}
                      className="flex w-full items-center gap-2 rounded-lg border border-outline-variant p-2 text-left hover:border-people-amber/40"
                    >
                      <PersonAvatar fullName={person.full_name} photoUrl={person.photo_url} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-on-surface">
                          {person.full_name}
                        </span>
                        {(person.job_title || person.company) && (
                          <span className="truncate text-xs text-on-surface-variant">
                            {[person.job_title, person.company].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-on-surface-variant">
                        {count === 0 ? '—' : `${count} chat${count === 1 ? '' : 's'}`}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </WidgetCard>

      <PersonDetailModal
        person={viewing}
        places={places}
        interactions={interactions}
        links={links}
        followUps={followUps}
        people={people}
        runMutation={runMutation}
        onChange={onChange}
        onEdit={() => {
          setEditingPerson(viewing)
          setViewingPerson(null)
        }}
        onDelete={() => {
          setDeletingPerson(viewing)
          setViewingPerson(null)
        }}
        onClose={closeViewingPerson}
      />

      <PersonFormModal
        isOpen={isAddOpen}
        heading="New person"
        onClose={() => setIsAddOpen(false)}
        onSave={async (values) => {
          const ok = await runMutation(() => supabase.from('people').insert(values))
          if (ok) {
            setIsAddOpen(false)
            onChange()
          }
        }}
      />

      <PersonFormModal
        isOpen={editingPerson !== null}
        heading="Edit person"
        initialValues={editingPerson}
        onClose={() => setEditingPerson(null)}
        onSave={async (values) => {
          if (!editingPerson) return
          const ok = await runMutation(() =>
            supabase
              .from('people')
              .update({ ...values, updated_at: new Date().toISOString() })
              .eq('id', editingPerson.id),
          )
          if (ok) {
            if (editingPerson.google_resource_name) pushToGoogle(editingPerson.id)
            setEditingPerson(null)
            onChange()
          }
        }}
      />

      <ConfirmDialog
        isOpen={deletingPerson !== null}
        message={`Delete ${deletingPerson?.full_name}? Their interactions stay, but they'll no longer be linked to them. This can't be undone.`}
        onCancel={() => setDeletingPerson(null)}
        onConfirm={async () => {
          if (!deletingPerson) return
          const ok = await runMutation(() =>
            supabase.from('people').delete().eq('id', deletingPerson.id),
          )
          if (ok) {
            setDeletingPerson(null)
            onChange()
          }
        }}
      />
    </>
  )
}
