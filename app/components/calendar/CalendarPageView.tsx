'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/lib/types'
import { connectGoogleCalendar } from '@/lib/google/connect'
import { londonDayBoundsUTC, londonWeekBoundsUTC, londonMonthBoundsUTC } from '@/lib/google/london-day'
import type { LondonDateRange } from '@/lib/google/london-day'
import WidgetCard from '../WidgetCard'
import TaskDetailModal from '../widgets/academic/TaskDetailModal'
import MonthView from './MonthView'
import WeekView from './WeekView'
import DayItemsList from './DayItemsList'
import DayDetailModal from './DayDetailModal'
import type { CalendarEvent, DayItem, EventSpan } from './calendarItems'
import { groupItemsByDate, getAllDayEventSpans, addDaysToKey } from './calendarItems'

type ViewMode = 'month' | 'week' | 'day'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function todayKeyLondon(): string {
  return londonDayBoundsUTC().startDateKey
}

function addMonthsToKey(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1, 12))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`
}

function mondayOfWeek(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Sun..6=Sat
  return addDaysToKey(key, dayOfWeek === 0 ? -6 : 1 - dayOfWeek)
}

function getRangeForView(view: ViewMode, dateKey: string): LondonDateRange {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (view === 'month') return londonMonthBoundsUTC(y, m)
  if (view === 'week') {
    const [wy, wm, wd] = mondayOfWeek(dateKey).split('-').map(Number)
    return londonWeekBoundsUTC(new Date(Date.UTC(wy, wm - 1, wd, 12)))
  }
  return londonDayBoundsUTC(new Date(Date.UTC(y, m - 1, d, 12)))
}

function formatTitle(view: ViewMode, dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (view === 'month') {
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
  if (view === 'week') {
    const monday = mondayOfWeek(dateKey)
    const sunday = addDaysToKey(monday, 6)
    const [my, mm, md] = monday.split('-').map(Number)
    const [sy, sm, sd] = sunday.split('-').map(Number)
    const start = new Date(Date.UTC(my, mm - 1, md)).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
    const end = new Date(Date.UTC(sy, sm - 1, sd)).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
    return `${start} – ${end}`
  }
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
]

export default function CalendarPageView() {
  const [view, setView] = useState<ViewMode>('month')
  const [selectedDateKey, setSelectedDateKey] = useState(() => todayKeyLondon())
  const [itemsByDate, setItemsByDate] = useState<Map<string, DayItem[]>>(new Map())
  const [spans, setSpans] = useState<EventSpan[]>([])
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailDateKey, setDetailDateKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNeedsReconnect(false)

    const range = getRangeForView(view, selectedDateKey)

    Promise.all([
      fetch(`/api/calendar/range?timeMin=${encodeURIComponent(range.timeMin)}&timeMax=${encodeURIComponent(range.timeMax)}`)
        .then(async (res) => {
          if (res.status === 409) {
            if (!cancelled) setNeedsReconnect(true)
            return []
          }
          if (!res.ok) return []
          const json = await res.json()
          return (json.events ?? []) as CalendarEvent[]
        })
        .catch(() => []),
      supabase.from('tasks').select('*').gte('due_date', range.startDateKey).lt('due_date', range.endDateKey),
      supabase.from('rugby_sessions').select('*').gte('date', range.startDateKey).lt('date', range.endDateKey),
    ]).then(([events, tasksRes, sessionsRes]) => {
      if (cancelled) return
      setItemsByDate(groupItemsByDate(events, tasksRes.data ?? [], sessionsRes.data ?? []))
      setSpans(getAllDayEventSpans(events))
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [view, selectedDateKey])

  const goPrev = () => {
    if (view === 'month') setSelectedDateKey((k) => addMonthsToKey(k, -1))
    else if (view === 'week') setSelectedDateKey((k) => addDaysToKey(k, -7))
    else setSelectedDateKey((k) => addDaysToKey(k, -1))
  }

  const goNext = () => {
    if (view === 'month') setSelectedDateKey((k) => addMonthsToKey(k, 1))
    else if (view === 'week') setSelectedDateKey((k) => addDaysToKey(k, 7))
    else setSelectedDateKey((k) => addDaysToKey(k, 1))
  }

  const goToday = () => setSelectedDateKey(todayKeyLondon())

  const todayKey = todayKeyLondon()
  const [year, month] = selectedDateKey.split('-').map(Number)

  return (
    <WidgetCard
      title="Calendar"
      icon={<CalendarDays className="h-4 w-4" />}
      accent="neutral"
      className="sm:col-span-2 xl:col-span-4"
      action={
        !needsReconnect && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-outline-variant p-0.5">
              {VIEW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setView(opt.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-200 ${
                    view === opt.value
                      ? 'bg-surface-container-high text-on-surface'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous"
                className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="rounded-md px-2 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              >
                Today
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next"
                className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )
      }
    >
      {needsReconnect ? (
        <div className="flex flex-col items-start gap-2">
          <p>Google Calendar isn&apos;t connected.</p>
          <button
            type="button"
            onClick={() => connectGoogleCalendar('/calendar')}
            className="flex items-center gap-1.5 rounded-md border border-outline-variant px-2.5 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
          >
            <RefreshCw className="h-3 w-3" />
            Reconnect Google Calendar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-sm font-semibold text-on-surface">
            {formatTitle(view, selectedDateKey)}
          </h3>

          {loading ? (
            <p>Loading...</p>
          ) : view === 'month' ? (
            <MonthView
              year={year}
              month={month}
              itemsByDate={itemsByDate}
              spans={spans}
              todayKey={todayKey}
              onSelectDate={setDetailDateKey}
            />
          ) : view === 'week' ? (
            <WeekView
              mondayKey={mondayOfWeek(selectedDateKey)}
              itemsByDate={itemsByDate}
              spans={spans}
              todayKey={todayKey}
              onSelectDate={setDetailDateKey}
            />
          ) : (
            <DayItemsList
              items={itemsByDate.get(selectedDateKey) ?? []}
              onSelectTask={setSelectedTask}
            />
          )}
        </div>
      )}

      {detailDateKey && (
        <DayDetailModal
          dateKey={detailDateKey}
          items={itemsByDate.get(detailDateKey) ?? []}
          onClose={() => setDetailDateKey(null)}
          onSelectTask={(task) => {
            setDetailDateKey(null)
            setSelectedTask(task)
          }}
        />
      )}

      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </WidgetCard>
  )
}
