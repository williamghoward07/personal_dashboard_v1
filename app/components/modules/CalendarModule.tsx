'use client'

import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Task, RugbySession } from '@/lib/types'
import WidgetCard from '../WidgetCard'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function CalendarModule() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [sessions, setSessions] = useState<RugbySession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = todayISO()
    Promise.all([
      supabase.from('tasks').select('*').eq('due_date', today),
      supabase.from('rugby_sessions').select('*').eq('date', today),
    ]).then(([t, s]) => {
      setTasks(t.data ?? [])
      setSessions(s.data ?? [])
      setLoading(false)
    })
  }, [])

  const isEmpty = !loading && tasks.length === 0 && sessions.length === 0

  return (
    <WidgetCard title="Calendar" icon={<CalendarDays className="h-4 w-4" />} accent="neutral">
      {loading ? (
        <p>Loading...</p>
      ) : isEmpty ? (
        <p>Nothing due today.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-academic-orange" />
              <span className="text-on-surface">
                {t.title}
                {t.type ? ` — ${t.type}` : ''}
              </span>
            </li>
          ))}
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-container" />
              <span className="text-on-surface">
                Rugby session{s.duration_minutes ? ` — ${s.duration_minutes}m` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}
