'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Task, RugbySession } from '@/lib/types'
import { connectGoogleCalendar } from '@/lib/google/connect'
import { londonDayBoundsUTC } from '@/lib/google/london-day'
import { pickNextUpcoming, type UpcomingCandidate } from '@/lib/calendar/next-upcoming'
import HomeSectionCard from '../widgets/home/HomeSectionCard'
import TaskDetailModal from '../widgets/academic/TaskDetailModal'

interface CalendarEvent {
  id: string
  title: string
  allDay: boolean
  start: string
  end: string | null
}

type DayItem =
  | { kind: 'calendar'; id: string; title: string; allDay: boolean; start: string | null }
  | { kind: 'task'; id: string; title: string; task: Task }
  | { kind: 'rugby'; id: string; title: string }

type UpcomingItem = UpcomingCandidate & { task?: Task }

const DOT_CLASS: Record<DayItem['kind'], string> = {
  calendar: 'bg-on-surface-variant',
  task: 'bg-academic-orange',
  rugby: 'bg-primary-container',
}

// How far ahead to look for a next-upcoming item once today's confirmed
// empty. A personal calendar rarely has a gap this long, so this is a
// generous ceiling rather than a tuned value — going further adds cost
// without meaningfully improving what a "what's next" glance shows.
const UPCOMING_LOOKAHEAD_DAYS = 90

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  })
}

// sortKey is either a plain 'YYYY-MM-DD' (all-day/task/rugby) or a full
// ISO datetime (timed calendar event) — see UpcomingCandidate.
function formatUpcomingWhen(sortKey: string, allDay: boolean) {
  const instant = allDay ? `${sortKey}T00:00:00Z` : sortKey
  const datePart = new Date(instant).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/London',
  })
  return allDay ? datePart : `${datePart} · ${formatTime(sortKey)}`
}

export default function CalendarModule() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [sessions, setSessions] = useState<RugbySession[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const [upcoming, setUpcoming] = useState<UpcomingItem | null>(null)
  const [upcomingLoading, setUpcomingLoading] = useState(false)

  useEffect(() => {
    const today = todayISO()

    Promise.all([
      supabase.from('tasks').select('*').eq('due_date', today),
      supabase.from('rugby_sessions').select('*').eq('date', today),
      fetch('/api/calendar/today')
        .then(async (res) => {
          if (res.status === 409) {
            setNeedsReconnect(true)
            return []
          }
          if (!res.ok) return []
          const json = await res.json()
          return (json.events ?? []) as CalendarEvent[]
        })
        .catch(() => []),
    ]).then(([t, s, e]) => {
      setTasks(t.data ?? [])
      setSessions(s.data ?? [])
      setEvents(e)
      setLoading(false)
    })
  }, [])

  // All-day items (calendar all-day events, tasks due today, rugby
  // sessions — none of them carry a time) sort before timed calendar
  // events, which are then ordered by start time.
  const allDayItems: DayItem[] = [
    ...events
      .filter((e) => e.allDay)
      .map((e): DayItem => ({ kind: 'calendar', id: e.id, title: e.title, allDay: true, start: null })),
    ...tasks.map((t): DayItem => ({ kind: 'task', id: t.id, title: t.title, task: t })),
    ...sessions.map(
      (s): DayItem => ({
        kind: 'rugby',
        id: s.id,
        title: `Rugby session${s.duration_minutes ? ` — ${s.duration_minutes}m` : ''}`,
      })
    ),
  ]

  const timedItems: DayItem[] = events
    .filter((e) => !e.allDay)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((e) => ({ kind: 'calendar', id: e.id, title: e.title, allDay: false, start: e.start }))

  const items = [...allDayItems, ...timedItems]
  const isEmpty = !loading && !needsReconnect && items.length === 0

  // Only fetch "what's next" once today's confirmed empty — the common
  // case (something's already on today) never needs this second round
  // trip.
  useEffect(() => {
    if (!isEmpty) {
      setUpcoming(null)
      return
    }

    let cancelled = false
    setUpcomingLoading(true)

    const todayRange = londonDayBoundsUTC()
    const windowEnd = londonDayBoundsUTC(new Date(Date.now() + UPCOMING_LOOKAHEAD_DAYS * 86_400_000))
    const rangeParams = new URLSearchParams({
      timeMin: todayRange.timeMax, // today's exclusive end == tomorrow's start
      timeMax: windowEnd.timeMax,
    })

    Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .gt('due_date', todayRange.startDateKey)
        .order('due_date', { ascending: true })
        .limit(1),
      supabase
        .from('rugby_sessions')
        .select('*')
        .gt('date', todayRange.startDateKey)
        .order('date', { ascending: true })
        .limit(1),
      fetch(`/api/calendar/range?${rangeParams.toString()}`)
        .then(async (res) => {
          if (!res.ok) return []
          const json = await res.json()
          return (json.events ?? []) as CalendarEvent[]
        })
        .catch(() => []),
    ]).then(([taskRes, rugbyRes, rangeEvents]) => {
      if (cancelled) return

      const candidates: UpcomingItem[] = [
        ...(taskRes.data ?? []).map(
          (t): UpcomingItem => ({
            kind: 'task',
            id: t.id,
            title: t.title,
            allDay: true,
            sortKey: t.due_date as string,
            task: t,
          })
        ),
        ...(rugbyRes.data ?? []).map(
          (s): UpcomingItem => ({
            kind: 'rugby',
            id: s.id,
            title: `Rugby session${s.duration_minutes ? ` — ${s.duration_minutes}m` : ''}`,
            allDay: true,
            sortKey: s.date,
          })
        ),
        ...rangeEvents.map(
          (e): UpcomingItem => ({
            kind: 'calendar',
            id: e.id,
            title: e.title,
            allDay: e.allDay,
            sortKey: e.start,
          })
        ),
      ]

      setUpcoming(pickNextUpcoming(candidates))
      setUpcomingLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [isEmpty])

  return (
    <HomeSectionCard href="/calendar" title="Calendar" icon={<CalendarDays className="h-4 w-4" />} accent="neutral">
      {loading ? (
        <p>Loading...</p>
      ) : needsReconnect ? (
        <div className="flex flex-col items-start gap-2">
          <p>Google Calendar isn&apos;t connected.</p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              connectGoogleCalendar()
            }}
            className="flex items-center gap-1.5 rounded-md border border-outline-variant px-2.5 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
          >
            <RefreshCw className="h-3 w-3" />
            Reconnect Google Calendar
          </button>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col gap-2">
          <p>Nothing on today.</p>
          <div className="border-t border-outline-variant/50" />
          {upcomingLoading ? (
            <p className="text-xs text-on-surface-variant">Loading next event…</p>
          ) : upcoming ? (
            <div className="flex items-center gap-2 text-sm">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[upcoming.kind]}`} />
              <span className="shrink-0 text-xs tabular-nums text-on-surface-variant">
                {formatUpcomingWhen(upcoming.sortKey, upcoming.allDay)}
              </span>
              {upcoming.kind === 'task' && upcoming.task ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setSelectedTask(upcoming.task ?? null)
                  }}
                  className="truncate text-left text-on-surface hover:underline"
                >
                  {upcoming.title}
                </button>
              ) : (
                <span className="truncate text-on-surface">{upcoming.title}</span>
              )}
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant">Nothing upcoming either.</p>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[item.kind]}`} />
              {item.kind === 'calendar' && !item.allDay && item.start && (
                <span className="shrink-0 text-xs tabular-nums text-on-surface-variant">
                  {formatTime(item.start)}
                </span>
              )}
              {item.kind === 'task' ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setSelectedTask(item.task)
                  }}
                  className="truncate text-left text-on-surface hover:underline"
                >
                  {item.title}
                </button>
              ) : (
                <span className="truncate text-on-surface">{item.title}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </HomeSectionCard>
  )
}
