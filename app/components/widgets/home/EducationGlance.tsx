'use client'

import { useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/lib/types'
import { widgetDensity, type HomeWidgetDimensions } from '@/lib/home/widget-content'
import { londonDayBoundsUTC } from '@/lib/google/london-day'
import { formatDueDay } from '../../lectures/work-format'
import HomeSectionCard from './HomeSectionCard'

const MAX_ROWS = 10

export default function EducationGlance(dimensions: HomeWidgetDimensions) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('tasks')
      .select('*')
      .gte('due_date', londonDayBoundsUTC().startDateKey)
      .order('due_date', { ascending: true })
      .limit(MAX_ROWS)
      .then(({ data }) => {
        setTasks(data ?? [])
        setLoading(false)
      })
  }, [])

  const density = widgetDensity(dimensions)
  const shown = tasks.slice(0, [3, 6, MAX_ROWS][density])

  return (
    <HomeSectionCard href="/education" title="Education" icon={<GraduationCap className="h-4 w-4" />} accent="orange">
      {loading ? (
        <p>Loading...</p>
      ) : shown.length === 0 ? (
        <p>Nothing due soon.</p>
      ) : (
        <ul className="grid gap-x-5 gap-y-2 @min-[680px]/home-widget:grid-cols-2">
          {shown.map((t) => (
            <li key={t.id} className="min-w-0">
              <p className="wrap-anywhere text-on-surface">{t.title}</p>
              <p className="wrap-anywhere text-xs text-on-surface-variant">
                {[t.due_date && formatDueDay(t.due_date), density > 0 && t.type].filter(Boolean).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </HomeSectionCard>
  )
}
