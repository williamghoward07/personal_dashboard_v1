'use client'

import { useEffect, useState } from 'react'
import { Contact } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { FollowUp } from '@/lib/types'
import HomeSectionCard from './HomeSectionCard'

export default function PeopleGlance() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('follow_ups')
      .select('*')
      .eq('done', false)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(3)
      .then(({ data }) => {
        setFollowUps(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <HomeSectionCard
      href="/people"
      title="People"
      icon={<Contact className="h-4 w-4" />}
      accent="amber"
    >
      {loading ? (
        <p>Loading...</p>
      ) : followUps.length === 0 ? (
        <p>Nothing to follow up.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {followUps.map((f) => (
            <li key={f.id} className="truncate text-on-surface">
              {f.note}
            </li>
          ))}
        </ul>
      )}
    </HomeSectionCard>
  )
}
