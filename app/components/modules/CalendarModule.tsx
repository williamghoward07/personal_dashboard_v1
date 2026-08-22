'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Task, ActivitySession } from '@/lib/types'
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
  | { kind: 'activity'; id: string; title: string }

type UpcomingItem = UpcomingCandidate & { task?: Task }

const DOT_CLASS: Record<DayItem['kind'], string> = {
  calendar: 'bg-on-surface-variant',
  task: 'bg-academic-orange',
  activity: 'bg-primary-container',
}

// How far ahead to look for a next-upcoming item once today and tomorrow
// are both confirmed empty. A personal calendar rarely has a gap this long,
// so this is a generous ceiling rather than a tuned value — going further
// adds cost without meaningfully improving what a "what's next" glance shows.
const UPCOMING_LOOKAHEAD_DAYS = 90

// Caps per day-section so a busy day can't blow out the bento card's height
// — mirrors the "+N more" truncation WeekRow.tsx uses on the full calendar.
const TODAY_CAP = 4
const TOMORROW_CAP = 3

function buildDayItems(events: CalendarEvent[], tasks: Task[], sessions: ActivitySession[]): DayItem[] {
  const allDayItems: DayItem[] = [
    ...events
      .filter((e) => e.allDay)
      .map((e): DayItem => ({ kind: 'calendar', id: e.id, title: e.title, allDay: true, start: null })),
    ...tasks.map((t): DayItem => ({ kind: 'task', id: t.id, title: t.title, task: t })),
    ...sessions.map(
      (s): DayItem => ({
        kind: 'activity',
        id: s.id,
        title: `${s.activity_type}${s.duration_minutes ? ` — ${s.duration_minutes}m` : ''}`,
      })
    ),
  ]

  const timedItems: DayItem[] = events
    .filter((e) => !e.allDay)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((e) => ({ kind: 'calendar', id: e.id, title: e.title, allDay: false, start: e.start }))

  return [...allDayItems, ...timedItems]
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  })
}

// sortKey is either a plain 'YYYY-MM-DD' (all-day/task/manual activity) or a full
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
  const [sessions, setSessions] = useState<ActivitySession[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tomorrowTasks, setTomorrowTasks] = useState<Task[]>([])
  const [tomorrowSessions, setTomorrowSessions] = useState<ActivitySession[]>([])
  const [tomorrowEvents, setTomorrowEvents] = useState<CalendarEvent[]>([])
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const [upcoming, setUpcoming] = useState<UpcomingItem | null>(null)
  const [upcomingLoading, setUpcomingLoading] = useState(false)

  useEffect(() => {
    const todayRange = londonDayBoundsUTC()
    const tomorrowRange = londonDayBoundsUTC(new Date(Date.now() + 86_400_000))

    Promise.all([
      supabase.from('tasks').select('*').eq('due_date', todayRange.startDateKey),
      supabase
        .from('activity_sessions')
        .select('*')
        .gte('occurred_at', todayRange.timeMin)
        .lt('occurred_at', todayRange.timeMax),
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
      supabase.from('tasks').select('*').eq('due_date', tomorrowRange.startDateKey),
      supabase
        .from('activity_sessions')
        .select('*')
        .gte('occurred_at', tomorrowRange.timeMin)
        .lt('occurred_at', tomorrowRange.timeMax),
      fetch(
        `/api/calendar/range?${new URLSearchParams({
          timeMin: tomorrowRange.timeMin,
          timeMax: tomorrowRange.timeMax,
        }).toString()}`
      )
        .then(async (res) => {
          if (!res.ok) return []
          const json = await res.json()
          return (json.events ?? []) as CalendarEvent[]
        })
        .catch(() => []),
    ]).then(([t, s, e, tt, ts, te]) => {
      setTasks(t.data ?? [])
      setSessions(s.data ?? [])
      setEvents(e)
      setTomorrowTasks(tt.data ?? [])
      setTomorrowSessions(ts.data ?? [])
      setTomorrowEvents(te)
      setLoading(false)
    })
  }, [])

  // Calendar all-day events, tasks due that day, and activity sessions sort
  // before timed calendar events, which are then ordered by start time.
  const items = buildDayItems(events, tasks, sessions)
  const tomorrowItems = buildDayItems(tomorrowEvents, tomorrowTasks, tomorrowSessions)
  const isEmpty = !loading && !needsReconnect && items.length === 0
  const isTomorrowEmpty = !loading && !needsReconnect && tomorrowItems.length === 0

  // Only fetch "what's next" once today AND tomorrow are confirmed empty —
  // the common case (something's on in the next two days) never needs this
  // second round trip.
  useEffect(() => {
    if (!isEmpty || !isTomorrowEmpty) {
      setUpcoming(null)
      return
    }

    let cancelled = false
    setUpcomingLoading(true)

    const tomorrowRange = londonDayBoundsUTC(new Date(Date.now() + 86_400_000))
    const windowEnd = londonDayBoundsUTC(new Date(Date.now() + UPCOMING_LOOKAHEAD_DAYS * 86_400_000))
    const rangeParams = new URLSearchParams({
      timeMin: tomorrowRange.timeMax, // tomorrow's exclusive end == day-after-tomorrow's start
      timeMax: windowEnd.timeMax,
    })

    Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .gt('due_date', tomorrowRange.startDateKey)
        .order('due_date', { ascending: true })
        .limit(1),
      supabase
        .from('activity_sessions')
        .select('*')
        .gt('occurred_at', tomorrowRange.timeMax)
        .order('occurred_at', { ascending: true })
        .limit(1),
      fetch(`/api/calendar/range?${rangeParams.toString()}`)
        .then(async (res) => {
          if (!res.ok) return []
          const json = await res.json()
          return (json.events ?? []) as CalendarEvent[]
        })
        .catch(() => []),
    ]).then(([taskRes, activityRes, rangeEvents]) => {
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
        ...(activityRes.data ?? []).map(
          (s): UpcomingItem => ({
            kind: 'activity',
            id: s.id,
            title: `${s.activity_type}${s.duration_minutes ? ` — ${s.duration_minutes}m` : ''}`,
            // Manual entries have no real time (the form is date-only);
            // a Strava import's occurred_at does, so it's worth showing.
            allDay: s.source === 'manual',
            sortKey: s.occurred_at,
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
  }, [isEmpty, isTomorrowEmpty])

  function renderDayItem(item: DayItem) {
    return (
      <li key={`${item.kind}-${item.id}`} className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[item.kind]}`} />
        {item.kind === 'calendar' && !item.allDay && item.start && (
          <span className="shrink-0 text-xs tabular-nums text-on-surface-variant">{formatTime(item.start)}</span>
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
    )
  }

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
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Today</p>
            {isEmpty ? (
              <p>Nothing on today.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {items.slice(0, TODAY_CAP).map(renderDayItem)}
                {items.length > TODAY_CAP && (
                  <li className="text-xs text-on-surface-variant">+{items.length - TODAY_CAP} more</li>
                )}
              </ul>
            )}
          </div>

          <div className="border-t border-outline-variant/50" />

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Tomorrow</p>
            {isTomorrowEmpty ? (
              <p>Nothing tomorrow.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {tomorrowItems.slice(0, TOMORROW_CAP).map(renderDayItem)}
                {tomorrowItems.length > TOMORROW_CAP && (
                  <li className="text-xs text-on-surface-variant">+{tomorrowItems.length - TOMORROW_CAP} more</li>
                )}
              </ul>
            )}
          </div>

          {isEmpty && isTomorrowEmpty && (
            <>
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
            </>
          )}
        </div>
      )}

      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </HomeSectionCard>
  )
}
