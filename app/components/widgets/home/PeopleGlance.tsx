'use client'

import { useEffect, useState } from 'react'
import { Contact } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Interaction } from '@/lib/types'
import HomeSectionCard from './HomeSectionCard'

export default function PeopleGlance() {
  const [followUps, setFollowUps] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('interactions')
      .select('*')
      .eq('follow_up_done', false)
      .not('follow_up', 'is', null)
      .order('occurred_at', { ascending: false })
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
          {followUps.map((i) => (
            <li key={i.id} className="truncate text-on-surface">
              {i.follow_up}
            </li>
          ))}
        </ul>
      )}
    </HomeSectionCard>
  )
}
