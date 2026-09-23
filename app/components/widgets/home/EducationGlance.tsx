'use client'

import { useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/lib/types'
import type { HomeWidgetProps } from '@/lib/home/layout'
import HomeSectionCard from './HomeSectionCard'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// A wider card can afford more deadlines. Fetched once at the ceiling and
// sliced in render, so dragging the card wider never refetches.
const MAX_ROWS = 8
function rowsForSpan(span: number) {
  if (span >= 3) return MAX_ROWS
  if (span === 2) return 5
  return 3
}

export default function EducationGlance({ span = 1 }: HomeWidgetProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('tasks')
      .select('*')
      .gte('due_date', todayISO())
      .order('due_date', { ascending: true })
      .limit(MAX_ROWS)
      .then(({ data }) => {
        setTasks(data ?? [])
        setLoading(false)
      })
  }, [])

  const shown = tasks.slice(0, rowsForSpan(span))

  return (
    <HomeSectionCard href="/education" title="Education" icon={<GraduationCap className="h-4 w-4" />} accent="orange">
      {loading ? (
        <p>Loading...</p>
      ) : shown.length === 0 ? (
        <p>Nothing due soon.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {shown.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-on-surface">
              <span className="truncate">{t.title}</span>
              <span className="shrink-0 text-xs text-on-surface-variant">{t.due_date}</span>
            </li>
          ))}
        </ul>
      )}
    </HomeSectionCard>
  )
}
