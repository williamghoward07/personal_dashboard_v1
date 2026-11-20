'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CalendarDays, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Task, ActivitySession } from '@/lib/types'
import { connectGoogleCalendar } from '@/lib/google/connect'
import { londonToday } from '@/lib/blackboard/dates'
import { calendarAgendaLayout, calendarDateRange, pickAgendaDays, widgetDensity, type HomeWidgetDimensions } from '@/lib/home/widget-content'
import { useTimetable } from '@/lib/lectures/use-timetable'
import { formatDueDay, londonTime } from '../lectures/work-format'
import { dotClassFor, groupItemsByDate, type CalendarEvent, type DayItem } from '../calendar/calendarItems'
import WidgetCard from '../WidgetCard'
import TaskDetailModal from '../widgets/academic/TaskDetailModal'

const AGENDA_DAYS = 14
const UPCOMING_LOOKAHEAD_DAYS = 90

interface CalendarRows {
  events: CalendarEvent[]
  tasks: Task[]
  sessions: ActivitySession[]
  needsReconnect: boolean
  failed: boolean
}

type DateGroup = [date: string, items: DayItem[]]

async function fetchEvents(timeMin: string, timeMax: string) {
  try {
    const res = await fetch(`/api/calendar/range?${new URLSearchParams({ timeMin, timeMax })}`)
    if (!res.ok) return { events: [], needsReconnect: res.status === 409, failed: res.status !== 409 }
    const { events = [] } = await res.json() as { events?: CalendarEvent[] }
    return { events, needsReconnect: false, failed: false }
  } catch {
    return { events: [], needsReconnect: false, failed: true }
  }
}

function CalendarDay({
  heading,
  items,
  limit,
  showLocation,
  compact,
  onTask,
}: {
  heading: string
  items: DayItem[]
  limit: number
  showLocation: boolean
  compact: boolean
  onTask: (task: Task) => void
}) {
  return (
    <section className="min-w-0 border-t border-outline-variant/50 pt-2">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{heading}</h3>
      {items.length === 0 ? <p className="text-xs">Nothing scheduled.</p> : (
        <ul className="space-y-1">
          {items.slice(0, limit).map((item) => {
            const time = item.kind === 'calendar' || item.kind === 'session' ? item.start : null
            const location = showLocation && item.kind === 'session' ? item.session.location : null
            const meta = [time && londonTime(time), location].filter(Boolean).join(' · ')
            return (
              <li key={`${item.kind}-${item.id}`} className={compact ? 'grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-2' : 'flex min-w-0 items-start gap-2'}>
                {compact ? (
                  <span className="pt-0.5 text-xs tabular-nums text-on-surface-variant">{time ? londonTime(time) : ''}</span>
                ) : (
                  <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotClassFor(item)}`} aria-hidden="true" />
                )}
                <div className="min-w-0">
                  {item.kind === 'task' ? (
                    <button
                      type="button"
                      onClick={() => onTask(item.task)}
                      className={`relative z-10 inline-flex min-h-11 min-w-11 max-w-full items-center rounded text-left break-words text-on-surface hover:underline [@media(pointer:fine)]:min-h-6 ${compact ? 'line-clamp-2' : ''}`}
                    >
                      {item.title}
                    </button>
                  ) : <p className={`break-words text-on-surface ${compact ? 'line-clamp-2' : ''}`}>{item.title}</p>}
                  {!compact && meta && <p className="break-words text-xs tabular-nums text-on-surface-variant">{meta}</p>}
                </div>
              </li>
            )
          })}
          {items.length > limit && <li className="text-xs">+{items.length - limit} more</li>}
        </ul>
      )}
    </section>
  )
}

export default function CalendarModule(dimensions: HomeWidgetDimensions) {
  const [today] = useState(() => londonToday(new Date()))
  const [rows, setRows] = useState<CalendarRows | null>(null)
  const [laterRows, setLaterRows] = useState<CalendarRows | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const agendaRange = useMemo(() => calendarDateRange(today, AGENDA_DAYS), [today])
  const lookaheadRange = useMemo(() => calendarDateRange(today, UPCOMING_LOOKAHEAD_DAYS), [today])
  const timetable = useTimetable(lookaheadRange)
  const { startDateKey, endDateKey, timeMin, timeMax } = agendaRange

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchEvents(timeMin, timeMax),
      supabase.from('tasks').select('*').gte('due_date', startDateKey).lt('due_date', endDateKey),
      supabase.from('activity_sessions').select('*').gte('occurred_at', timeMin).lt('occurred_at', timeMax),
    ]).then(([calendar, tasks, sessions]) => {
      if (cancelled) return
      setRows({
        ...calendar,
        tasks: tasks.data ?? [],
        sessions: sessions.data ?? [],
        failed: calendar.failed || !!tasks.error || !!sessions.error,
      })
    })
    return () => { cancelled = true }
  }, [startDateKey, endDateKey, timeMin, timeMax])

  const days = useMemo(() => {
    if (!rows) return []
    const groups = groupItemsByDate({
      ...rows,
      routineInstances: [],
      timetable: timetable.sessions,
      tracked: timetable.tracked,
    })
    return [...groups].filter(([date]) => date >= startDateKey && date < endDateKey).sort(([a], [b]) => a.localeCompare(b))
  }, [rows, timetable.sessions, timetable.tracked, startDateKey, endDateKey])

  // Only look beyond the agenda when both sources are ready and it contains no events.
  const shouldFetchLater = !!rows && !timetable.loading && days.length === 0
  const needsReconnect = rows?.needsReconnect ?? false
  useEffect(() => {
    if (!shouldFetchLater) return
    let cancelled = false
    const laterEnd = lookaheadRange.endDateKey
    const laterTimeMax = lookaheadRange.timeMax
    const events = needsReconnect
      ? Promise.resolve({ events: [], needsReconnect, failed: false })
      : fetchEvents(timeMax, laterTimeMax)
    Promise.all([
      events,
      supabase.from('tasks').select('*').gte('due_date', endDateKey).lt('due_date', laterEnd).order('due_date').limit(1),
      supabase.from('activity_sessions').select('*').gte('occurred_at', timeMax).lt('occurred_at', laterTimeMax).order('occurred_at').limit(1),
    ]).then(([calendar, tasks, sessions]) => {
      if (cancelled) return
      setLaterRows({
        ...calendar,
        tasks: tasks.data ?? [],
        sessions: sessions.data ?? [],
        failed: calendar.failed || !!tasks.error || !!sessions.error,
      })
    })
    return () => { cancelled = true }
  }, [shouldFetchLater, needsReconnect, endDateKey, timeMax, lookaheadRange])

  const density = widgetDensity(dimensions)
  const layout = calendarAgendaLayout(dimensions)
  const tomorrow = calendarDateRange(today, 1).endDateKey
  const later = laterRows && [...groupItemsByDate({
    ...laterRows,
    routineInstances: [],
    timetable: timetable.sessions,
    tracked: timetable.tracked,
  })].filter(([date]) => date >= endDateKey && date < lookaheadRange.endDateKey).sort(([a], [b]) => a.localeCompare(b))[0]
  const next = later

  const shown: DateGroup[] = days.some(([, items]) => items.length > 0)
    ? pickAgendaDays(days, today, layout.maxDays)
    : []
  const loading = !rows || timetable.loading
  const failed = rows?.failed || (timetable.error && timetable.error !== 'not_configured')
  const nextFailed = laterRows?.failed

  return (
    <>
      <WidgetCard
        title="Calendar"
        icon={<CalendarDays className="h-4 w-4" />}
        className="relative h-full min-w-0"
        action={
          <Link
            href="/calendar"
            aria-label="Open Calendar"
            className="grid min-h-11 min-w-11 place-items-center rounded text-on-surface-variant after:absolute after:inset-0 after:rounded-xl hover:text-on-surface [@media(pointer:fine)]:min-h-6 [@media(pointer:fine)]:min-w-6"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        }
      >
        {loading ? <p>Loading calendar…</p> : (
          <div className="space-y-3">
            {(needsReconnect || laterRows?.needsReconnect) && (
              <div className="space-y-1">
                <p>Google Calendar isn&apos;t connected.</p>
                <button
                  type="button"
                  onClick={() => connectGoogleCalendar()}
                  className="relative z-10 inline-flex min-h-11 max-w-full items-center gap-2 rounded-md border border-outline-variant px-2.5 text-left text-xs font-semibold text-on-surface hover:bg-surface-container-high"
                >
                  <RefreshCw className="h-3 w-3 shrink-0" />
                  Reconnect Google Calendar
                </button>
              </div>
            )}
            {shown.length > 0 ? (
              <div className="grid grid-cols-1 items-start gap-3 @min-[620px]/home-widget:grid-cols-2 @min-[980px]/home-widget:grid-cols-3">
                {shown.map(([date, items]) => (
                  <CalendarDay
                    key={date}
                    heading={date === today ? 'Today' : date === tomorrow ? 'Tomorrow' : formatDueDay(date)}
                    items={items}
                    limit={date === today ? layout.todayLimit : layout.dayLimit}
                    showLocation={density > 0} compact={density === 0}
                    onTask={setSelectedTask}
                  />
                ))}
              </div>
            ) : (
              <>
                <p>Nothing scheduled in the next {AGENDA_DAYS} days.</p>
                {next ? (
                  <CalendarDay heading={`Next up · ${formatDueDay(next[0])}`} items={next[1]} limit={1} showLocation={density > 0} compact={density === 0} onTask={setSelectedTask} />
                ) : !laterRows ? <p className="text-xs">Looking for the next event…</p> : null}
              </>
            )}
            {(failed || nextFailed) && <p className="text-xs text-error">Some calendar data could not be loaded.</p>}
          </div>
        )}
      </WidgetCard>
      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </>
  )
}
