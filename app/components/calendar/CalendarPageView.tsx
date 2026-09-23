'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Wand2, ZoomIn, ZoomOut } from 'lucide-react'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { supabase } from '@/lib/supabase'
import type { RoutineInstance, Task } from '@/lib/types'
import { connectGoogleCalendar } from '@/lib/google/connect'
import { londonDayBoundsUTC, londonWeekBoundsUTC, londonMonthBoundsUTC } from '@/lib/google/london-day'
import type { LondonDateRange } from '@/lib/google/london-day'
import WidgetCard from '../WidgetCard'
import TaskDetailModal from '../widgets/academic/TaskDetailModal'
import MonthView from './MonthView'
import WeekView from './WeekView'
import DayGridView from './DayGridView'
import AgendaView from './AgendaView'
import DayDetailModal from './DayDetailModal'
import RoutinesPanel from './routines/RoutinesPanel'
import RoutineInstanceModal from './routines/RoutineInstanceModal'
import TimeBlockWizardModal from './timeblock/TimeBlockWizardModal'
import type { CalendarEvent, DayItem, EventSpan } from './calendarItems'
import { groupItemsByDate, getBarSpans, addDaysToKey } from './calendarItems'
import { MAX_PX_PER_MIN, MINUTES_PER_DAY } from './time-grid/grid-math'

type ViewMode = 'month' | 'week' | 'day' | 'routines'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function todayKeyLondon(): string {
  return londonDayBoundsUTC().startDateKey
}

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

// Jump-to-today button label — shows the SELECTED day, not always today:
// relative names ("Today"/"Tomorrow"/"Yesterday") when they apply, otherwise
// a short "Wed 19th" format.
function formatTodayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'short',
    timeZone: 'UTC',
  })
  return `${weekday} ${d}${ordinalSuffix(d)}`
}

function formatSelectedDayLabel(selectedDateKey: string, todayKey: string): string {
  if (selectedDateKey === todayKey) return 'Today'
  if (selectedDateKey === addDaysToKey(todayKey, 1)) return 'Tomorrow'
  if (selectedDateKey === addDaysToKey(todayKey, -1)) return 'Yesterday'
  return formatTodayLabel(selectedDateKey)
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
  { value: 'routines', label: 'Routines' },
]

type GridMode = 'grid' | 'agenda'

const GRID_MODE_OPTIONS: { value: GridMode; label: string }[] = [
  { value: 'grid', label: 'Grid' },
  { value: 'agenda', label: 'Agenda' },
]

// Everything rendered above the hour grid box (sticky top bar, page header,
// widget card chrome, the calendar's own title/toolbar row) — used as a
// generous, shared-across-Day/Week estimate so the grid can size itself to
// "whatever's left" of the viewport instead of a small fixed pixel cap.
const RESERVED_CHROME_PX = 360
// Reuses the old fixed cap as a floor, so a short/laptop viewport still
// looks exactly like it used to rather than shrinking further.
const MIN_GRID_CONTAINER_PX = 480
const SSR_FALLBACK_VIEWPORT_PX = RESERVED_CHROME_PX + MIN_GRID_CONTAINER_PX

export default function CalendarPageView() {
  const [view, setView] = useState<ViewMode>('month')
  const [gridMode, setGridMode] = useState<GridMode>('grid')
  // null = not manually zoomed — pxPerMin below tracks fitPxPerMin instead,
  // so the grid stays auto-fitted to the viewport until the user picks a
  // zoom level themselves ("Fit day" resets this back to null).
  const [manualPxPerMin, setManualPxPerMin] = useState<number | null>(null)
  // Read only after mount (see effect below) — window isn't available
  // during SSR, so this fallback keeps the first client render matching
  // the server-rendered markup exactly.
  const [viewportH, setViewportH] = useState(SSR_FALLBACK_VIEWPORT_PX)
  const [selectedDateKey, setSelectedDateKey] = useState(() => todayKeyLondon())
  const [itemsByDate, setItemsByDate] = useState<Map<string, DayItem[]>>(new Map())
  const [spans, setSpans] = useState<EventSpan[]>([])
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailDateKey, setDetailDateKey] = useState<string | null>(null)
  const [selectedRoutineInstance, setSelectedRoutineInstance] = useState<RoutineInstance | null>(null)
  const [timeBlockOpen, setTimeBlockOpen] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const refetch = () => setRefreshToken((t) => t + 1)

  const maxContainerHeightPx = Math.max(MIN_GRID_CONTAINER_PX, viewportH - RESERVED_CHROME_PX)
  const fitPxPerMin = maxContainerHeightPx / MINUTES_PER_DAY
  const zoomMaxPxPerMin = Math.max(MAX_PX_PER_MIN, fitPxPerMin * 2)
  // The actual zoom level in effect: whatever the user picked, or the
  // viewport-fit value if they haven't touched the slider.
  const pxPerMin = manualPxPerMin ?? fitPxPerMin

  useEffect(() => {
    const updateViewportH = () => setViewportH(window.innerHeight)
    updateViewportH()
    window.addEventListener('resize', updateViewportH)
    return () => window.removeEventListener('resize', updateViewportH)
  }, [])

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
      supabase.from('activity_sessions').select('*').gte('occurred_at', range.timeMin).lt('occurred_at', range.timeMax),
      // Fetched for every view, not just 'routines' — Month/Week/Day all
      // need the dedup-against-Google + distinct-colour + click-to-open
      // treatment for scheduled routines, not just the Routines tab itself.
      supabase.from('routine_instances').select('*').gte('start_at', range.timeMin).lt('start_at', range.timeMax),
    ]).then(([events, tasksRes, sessionsRes, routineInstancesRes]) => {
      if (cancelled) return
      setItemsByDate(
        groupItemsByDate(
          events,
          tasksRes.data ?? [],
          sessionsRes.data ?? [],
          (routineInstancesRes.data ?? []) as RoutineInstance[]
        )
      )
      setSpans(getBarSpans(events))
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [view, selectedDateKey, refreshToken])

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
            <FilterTabs
              aria-label="Calendar view"
              size="compact"
              value={view}
              onChange={setView}
              options={VIEW_OPTIONS}
            />
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
                aria-label="Jump to today"
                title="Jump to today"
                className="rounded-md px-2 py-1 text-xs font-semibold tabular-nums text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              >
                {formatSelectedDayLabel(selectedDateKey, todayKey)}
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
            {/* Always available, not just on a 409 — lets you re-consent
                for a newly added scope (e.g. calendar write) even while
                the old token still works fine for reads. */}
            <button
              type="button"
              onClick={() => connectGoogleCalendar('/calendar')}
              aria-label="Reconnect Google Calendar"
              title="Reconnect Google Calendar"
              className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
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
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-sm font-semibold text-on-surface">
              {formatTitle(view, selectedDateKey)}
            </h3>
            {(view === 'day' || view === 'week') && (
              <div className="flex items-center gap-3">
                {gridMode === 'grid' && (
                  <div
                    className="flex items-center gap-1.5"
                    title="Zoom the hour grid — shrink it all the way to fit the whole day with no scrolling"
                  >
                    <ZoomOut className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" />
                    <input
                      type="range"
                      min={fitPxPerMin}
                      max={zoomMaxPxPerMin}
                      step={0.05}
                      value={pxPerMin}
                      onChange={(e) => setManualPxPerMin(Number(e.target.value))}
                      aria-label="Hour grid zoom"
                      className="h-1 w-20 accent-on-surface-variant"
                    />
                    <ZoomIn className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" />
                    <button
                      type="button"
                      onClick={() => setManualPxPerMin(null)}
                      className="rounded-md px-1.5 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    >
                      Fit day
                    </button>
                  </div>
                )}
                <FilterTabs
                  aria-label="Grid or agenda view"
                  size="compact"
                  value={gridMode}
                  onChange={setGridMode}
                  options={GRID_MODE_OPTIONS}
                />
              </div>
            )}
          </div>

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
          ) : view === 'week' && gridMode === 'agenda' ? (
            <AgendaView
              dateKeys={Array.from({ length: 7 }, (_, i) => addDaysToKey(mondayOfWeek(selectedDateKey), i))}
              itemsByDate={itemsByDate}
              todayKey={todayKey}
              onSelectTask={setSelectedTask}
              onSelectRoutineInstance={setSelectedRoutineInstance}
            />
          ) : view === 'week' ? (
            <WeekView
              mondayKey={mondayOfWeek(selectedDateKey)}
              itemsByDate={itemsByDate}
              spans={spans}
              todayKey={todayKey}
              pxPerMin={pxPerMin}
              maxContainerHeightPx={maxContainerHeightPx}
              onSelectDate={(dateKey) => {
                setSelectedDateKey(dateKey)
                setView('day')
              }}
              onSelectTask={setSelectedTask}
              onSelectRoutineInstance={setSelectedRoutineInstance}
            />
          ) : view === 'routines' ? (
            <RoutinesPanel
              dateKey={selectedDateKey}
              items={itemsByDate.get(selectedDateKey) ?? []}
              onScheduled={refetch}
              onSelectRoutineInstance={setSelectedRoutineInstance}
              onSelectTask={setSelectedTask}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {selectedDateKey === todayKey && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setTimeBlockOpen(true)}
                    className="flex items-center gap-1.5 rounded-md border border-outline-variant px-2.5 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Auto time-block today
                  </button>
                </div>
              )}
              {gridMode === 'agenda' ? (
                <AgendaView
                  dateKeys={[selectedDateKey]}
                  itemsByDate={itemsByDate}
                  todayKey={todayKey}
                  onSelectTask={setSelectedTask}
                  onSelectRoutineInstance={setSelectedRoutineInstance}
                />
              ) : (
                <DayGridView
                  dateKey={selectedDateKey}
                  items={itemsByDate.get(selectedDateKey) ?? []}
                  isToday={selectedDateKey === todayKey}
                  pxPerMin={pxPerMin}
                  maxContainerHeightPx={maxContainerHeightPx}
                  onSelectTask={setSelectedTask}
                  onSelectRoutineInstance={setSelectedRoutineInstance}
                />
              )}
            </div>
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
          onSelectRoutineInstance={(instance) => {
            setDetailDateKey(null)
            setSelectedRoutineInstance(instance)
          }}
        />
      )}

      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />}

      {selectedRoutineInstance && (
        <RoutineInstanceModal
          instance={selectedRoutineInstance}
          onClose={() => setSelectedRoutineInstance(null)}
          onChanged={refetch}
        />
      )}

      {timeBlockOpen && (
        <TimeBlockWizardModal
          todayDateKey={todayKey}
          onClose={() => setTimeBlockOpen(false)}
          onScheduled={refetch}
        />
      )}
    </WidgetCard>
  )
}
