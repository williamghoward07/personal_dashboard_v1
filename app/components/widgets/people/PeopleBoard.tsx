'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Interaction, InteractionPerson, Person, Place } from '@/lib/types'
import PeopleDirectoryCard from './PeopleDirectoryCard'
import FollowUpsCard from './FollowUpsCard'
import InteractionsCard from './InteractionsCard'
import PlacesCard from './PlacesCard'
import GoogleContactsCard from './GoogleContactsCard'
import QuickAddBar from './QuickAddBar'

const MIGRATION_HINT =
  'Have you run supabase/migrations/20260810000000_people_crm.sql in the Supabase SQL editor yet?'

export default function PeopleBoard() {
  const [people, setPeople] = useState<Person[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [links, setLinks] = useState<InteractionPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    Promise.all([
      supabase.from('people').select('*').order('full_name', { ascending: true }),
      supabase.from('places').select('*').order('name', { ascending: true }),
      supabase.from('interactions').select('*').order('occurred_at', { ascending: false }),
      supabase.from('interaction_people').select('*'),
    ]).then(([peopleRes, placesRes, interactionsRes, linksRes]) => {
      const failed = [peopleRes, placesRes, interactionsRes, linksRes].find((r) => r.error)
      setError(failed?.error ? `Couldn't load People: ${failed.error.message}. ${MIGRATION_HINT}` : null)
      setPeople(peopleRes.data ?? [])
      setPlaces(placesRes.data ?? [])
      setInteractions(interactionsRes.data ?? [])
      setLinks(linksRes.data ?? [])
      setLoading(false)
    })
  }

  useEffect(refresh, [])

  /** Wraps a write so failures surface in the banner instead of vanishing. */
  const runMutation = async (
    fn: () => PromiseLike<{ error: { message: string } | null }>,
  ) => {
    const { error: mutationError } = await fn()
    if (mutationError) {
      setError(`Couldn't save: ${mutationError.message}. ${MIGRATION_HINT}`)
      return false
    }
    setError(null)
    return true
  }

  /**
   * Best-effort push of a Google-linked person's contact-card edit back to
   * Google. Never rolls back the (already-successful) local save on
   * failure — just surfaces a non-blocking note in the banner.
   */
  const pushToGoogle = async (personId: string) => {
    const res = await fetch('/api/google/contacts/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(`Saved locally — couldn't sync the change to Google Contacts. ${body?.error ?? ''}`.trim())
    }
  }

  return (
    <>
      {error && (
        <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error sm:col-span-2 xl:col-span-4">
          {error}
        </div>
      )}

      <QuickAddBar
        people={people}
        places={places}
        runMutation={runMutation}
        onChange={refresh}
        pushToGoogle={pushToGoogle}
      />

      <PeopleDirectoryCard
        people={people}
        places={places}
        interactions={interactions}
        links={links}
        loading={loading}
        runMutation={runMutation}
        onChange={refresh}
        pushToGoogle={pushToGoogle}
      />

      <FollowUpsCard
        people={people}
        interactions={interactions}
        links={links}
        loading={loading}
        runMutation={runMutation}
        onChange={refresh}
      />

      <InteractionsCard
        people={people}
        places={places}
        interactions={interactions}
        links={links}
        loading={loading}
        runMutation={runMutation}
        onChange={refresh}
      />

      <PlacesCard
        people={people}
        places={places}
        interactions={interactions}
        links={links}
        loading={loading}
        runMutation={runMutation}
        onChange={refresh}
      />

      <GoogleContactsCard onChange={refresh} />
    </>
  )
}
