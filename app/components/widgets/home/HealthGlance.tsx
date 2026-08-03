'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { RugbySession } from '@/lib/types'
import HomeSectionCard from './HomeSectionCard'

export default function HealthGlance() {
  const [session, setSession] = useState<RugbySession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('rugby_sessions')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setSession(data?.[0] ?? null)
        setLoading(false)
      })
  }, [])

  return (
    <HomeSectionCard href="/health" title="Health" icon={<Heart className="h-4 w-4" />} accent="mint">
      {loading ? (
        <p>Loading...</p>
      ) : session ? (
        <span className="text-on-surface">
          Last rugby session: {session.date}
          {session.duration_minutes ? ` · ${session.duration_minutes}m` : ''}
        </span>
      ) : (
        <p>No sessions logged yet.</p>
      )}
    </HomeSectionCard>
  )
}
