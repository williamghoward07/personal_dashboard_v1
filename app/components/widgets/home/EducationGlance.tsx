'use client'

import { useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/lib/types'
import HomeSectionCard from './HomeSectionCard'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function EducationGlance() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('tasks')
      .select('*')
      .gte('due_date', todayISO())
      .order('due_date', { ascending: true })
      .limit(3)
      .then(({ data }) => {
        setTasks(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <HomeSectionCard href="/education" title="Education" icon={<GraduationCap className="h-4 w-4" />} accent="orange">
      {loading ? (
        <p>Loading...</p>
      ) : tasks.length === 0 ? (
        <p>Nothing due soon.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tasks.map((t) => (
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
