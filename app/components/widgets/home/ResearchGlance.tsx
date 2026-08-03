'use client'

import { useEffect, useState } from 'react'
import { FileSearch } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import HomeSectionCard from './HomeSectionCard'

export default function ResearchGlance() {
  const [counts, setCounts] = useState<{ prompts: number; links: number } | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('prompts').select('*', { count: 'exact', head: true }),
      supabase.from('perplexity_links').select('*', { count: 'exact', head: true }),
    ]).then(([p, l]) => {
      setCounts({ prompts: p.count ?? 0, links: l.count ?? 0 })
    })
  }, [])

  return (
    <HomeSectionCard href="/research" title="Research" icon={<FileSearch className="h-4 w-4" />} accent="pink">
      {counts === null ? (
        <p>Loading...</p>
      ) : (
        <p className="text-on-surface">
          {counts.prompts} prompt{counts.prompts === 1 ? '' : 's'} · {counts.links} saved chat
          {counts.links === 1 ? '' : 's'}
        </p>
      )}
    </HomeSectionCard>
  )
}
