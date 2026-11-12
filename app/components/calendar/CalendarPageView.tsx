'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Wand2, ZoomIn, ZoomOut } from 'lucide-react'
import { useFillViewportHeight } from '@/lib/ui/use-fill-viewport-height'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/lib/settings/use-settings'
import type { ActivitySession, RoutineInstance, Task } from '@/lib/types'
import { useTimetable } from '@/lib/lectures/use-timetable'
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
import { DEFAULT_PX_PER_MIN, MAX_PX_PER_MIN, MINUTES_PER_DAY, ZOOM_STEP } from './time-grid/grid-math'

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
  if (view === 'month') {
    // Whole weeks, like the grid: the days before the 1st and after the
    // last day fill the first and last rows (dimmed), with their events.
    const month = londonMonthBoundsUTC(y, m)
    const first = mondayOfWeek(month.startDateKey)
    const last = mondayOfWeek(addDaysToKey(month.endDateKey, -1))
    const [fy, fm, fd] = first.split('-').map(Number)
    const [ly, lm, ld] = last.split('-').map(Number)
    const start = londonWeekBoundsUTC(new Date(Date.UTC(fy, fm - 1, fd, 12)))
    const end = londonWeekBoundsUTC(new Date(Date.UTC(ly, lm - 1, ld, 12)))
    return { timeMin: start.timeMin, timeMax: end.timeMax, startDateKey: start.startDateKey, endDateKey: end.endDateKey }
  }
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
  // No weekday: the day column's own heading shows it.
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
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

// Below the calendar body: the card's bottom padding and border, then the
// page's bottom padding. The body itself is measured, so it ends exactly
// at the bottom of the window whatever sits above it.
const BODY_BOTTOM_GAP_PX = 24 + 1 + 24
// On a short window the body stops shrinking here and the page scrolls.
const MIN_BODY_PX = 420
// Until the hour grid has been measured (first paint, SSR).
const FALLBACK_GRID_PX = 560

export default function CalendarPageView() {
  const { settings, updateSettings } = useSettings()
  const [viewOverride, setViewOverride] = useState<ViewMode | null>(null)
  // Saved view once settings load; 'week' until then (and when nothing is saved).
  const view: ViewMode = viewOverride ?? settings.calendar_view
  const setView = (next: ViewMode) => {
    setViewOverride(next)
    void updateSettings({ calendar_view: next })
  }
  const [gridMode, setGridMode] = useState<GridMode>('grid')
  // null = not manually zoomed — pxPerMin below opens at a readable
  // DEFAULT_PX_PER_MIN (or the viewport fit, if that's already roomier)
  // until the user picks a zoom level themselves. "Fit day" sets it to the
  // fit value.
  const [manualPxPerMin, setManualPxPerMin] = useState<number | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const bodyHeight = useFillViewportHeight(bodyRef, BODY_BOTTOM_GAP_PX, MIN_BODY_PX)
  // The hour grid's visible height, reported by Week/Day once laid out:
  // "Fit day" zooms the whole 24h into exactly this.
  const [gridViewportPx, setGridViewportPx] = useState(0)
  const [selectedDateKey, setSelectedDateKey] = useState(() => todayKeyLondon())
  const [fetched, setFetched] = useState<{
    events: CalendarEvent[]
    tasks: Task[]
    sessions: ActivitySession[]
    routineInstances: RoutineInstance[]
  } | null>(null)
  const [spans, setSpans] = useState<EventSpan[]>([])
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailDateKey, setDetailDateKey] = useState<string | null>(null)
  const [selectedRoutineInstance, setSelectedRoutineInstance] = useState<RoutineInstance | null>(null)
  const [timeBlockOpen, setTimeBlockOpen] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const refetch = () => setRefreshToken((t) => t + 1)

  const fitPxPerMin = (gridViewportPx || FALLBACK_GRID_PX) / MINUTES_PER_DAY
  const zoomMaxPxPerMin = Math.max(MAX_PX_PER_MIN, fitPxPerMin * 2)
  // The actual zoom level in effect: whatever the user picked, or the
  // readable default if they haven't touched the zoom.
  const pxPerMin = manualPxPerMin ?? Math.min(zoomMaxPxPerMin, Math.max(fitPxPerMin, DEFAULT_PX_PER_MIN))
  const setZoom = (next: number) => setManualPxPerMin(Math.min(zoomMaxPxPerMin, Math.max(fitPxPerMin, next)))

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
      setFetched({
        events,
        tasks: tasksRes.data ?? [],
        sessions: sessionsRes.data ?? [],
        routineInstances: (routineInstancesRes.data ?? []) as RoutineInstance[],
      })
      setSpans(getBarSpans(events))
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [view, selectedDateKey, refreshToken])

  // Timetable sessions (lectures etc.) are fetched on their own, so ticking
  // a reading in the session popover refreshes their traffic lights without
  // reloading — and blanking — the whole calendar.
  const range = useMemo(() => getRangeForView(view, selectedDateKey), [view, selectedDateKey])
  const timetable = useTimetable({ timeMin: range.timeMin, timeMax: range.timeMax })
  const itemsByDate = useMemo<Map<string, DayItem[]>>(
    () =>
      fetched
        ? groupItemsByDate(
            fetched.events,
            fetched.tasks,
            fetched.sessions,
            fetched.routineInstances,
            timetable.sessions,
            timetable.tracked
          )
        : new Map(),
    [fetched, timetable.sessions, timetable.tracked]
  )

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

  const isGrid = (view === 'day' || view === 'week') && gridMode === 'grid'
  // Grid and month views fill the window like Google Calendar; agenda and
  // routines are lists and keep their natural height.
  const fillsBody = isGrid || view === 'month'
  const timeBlockButton = (
    <button
      type="button"
      onClick={() => setTimeBlockOpen(true)}
      className="flex items-center gap-1.5 rounded-md border border-outline-variant px-2.5 py-1 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
    >
      <Wand2 className="h-3.5 w-3.5" />
      Auto time-block today
    </button>
  )
  const iconButton =
    'rounded-md p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40'

  return (
    <WidgetCard
      title={
        <span className="flex items-center gap-2">
          {needsReconnect ? 'Calendar' : formatTitle(view, selectedDateKey)}
          {loading && fetched && <span className="text-xs font-normal text-on-surface-variant">Loading…</span>}
        </span>
      }
      icon={<CalendarDays className="h-4 w-4" />}
      accent="neutral"
      className="hover:translate-y-0 sm:col-span-2 xl:col-span-4"
      action={
        !needsReconnect && (
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goToday}
                aria-label="Jump to today"
                title="Jump to today"
                className="rounded-md border border-outline-variant px-2.5 py-1 text-xs font-semibold tabular-nums text-on-surface hover:bg-surface-container-high"
              >
                {formatSelectedDayLabel(selectedDateKey, todayKey)}
              </button>
              <button type="button" onClick={goPrev} aria-label="Previous" className={iconButton}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={goNext} aria-label="Next" className={iconButton}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {isGrid && (
              <div
                className="flex items-center gap-0.5"
                title="Zoom the hour grid — Fit shows the whole day with no scrolling"
              >
                <button
                  type="button"
                  onClick={() => setZoom(pxPerMin / ZOOM_STEP)}
                  disabled={pxPerMin <= fitPxPerMin}
                  aria-label="Zoom out"
                  className={iconButton}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(pxPerMin * ZOOM_STEP)}
                  disabled={pxPerMin >= zoomMaxPxPerMin}
                  aria-label="Zoom in"
                  className={iconButton}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setManualPxPerMin(fitPxPerMin)}
                  className="rounded-md px-1.5 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                >
                  Fit
                </button>
              </div>
            )}
            {(view === 'day' || view === 'week') && (
              <FilterTabs
                aria-label="Grid or agenda view"
                size="compact"
                value={gridMode}
                onChange={setGridMode}
                options={GRID_MODE_OPTIONS}
              />
            )}
            <FilterTabs
              aria-label="Calendar view"
              size="compact"
              value={view}
              onChange={setView}
              options={VIEW_OPTIONS}
            />
            {/* Always available, not just on a 409 — lets you re-consent
                for a newly added scope (e.g. calendar write) even while
                the old token still works fine for reads. */}
            <button
              type="button"
              onClick={() => connectGoogleCalendar('/calendar')}
              aria-label="Reconnect Google Calendar"
              title="Reconnect Google Calendar"
              className={iconButton}
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
        <div
          ref={bodyRef}
          className="flex min-h-0 flex-col"
          style={fillsBody && bodyHeight !== null ? { height: bodyHeight } : undefined}
        >
          {!fetched ? (
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
              onGridViewportHeight={setGridViewportPx}
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
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {gridMode === 'agenda' && selectedDateKey === todayKey && (
                <div className="flex justify-end">{timeBlockButton}</div>
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
                  onGridViewportHeight={setGridViewportPx}
                  onSelectTask={setSelectedTask}
                  onSelectRoutineInstance={setSelectedRoutineInstance}
                  headerAction={
                    selectedDateKey === todayKey && timeBlockButton
                  }
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
