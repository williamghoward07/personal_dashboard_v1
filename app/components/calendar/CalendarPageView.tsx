'use client'

import LoadingSkeleton from '@/app/components/LoadingSkeleton'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ListTodo, RefreshCw, Wand2, ZoomIn, ZoomOut } from 'lucide-react'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/lib/settings/use-settings'
import type { ActivitySession, RoutineInstance, Task } from '@/lib/types'
import { useWorkItems } from '@/lib/blackboard/use-work-items'
import { useTimetable } from '@/lib/lectures/use-timetable'
import { connectGoogleCalendar } from '@/lib/google/connect'
import { londonDayBoundsUTC, londonWeekBoundsUTC, londonMonthBoundsUTC } from '@/lib/google/london-day'
import type { LondonDateRange } from '@/lib/google/london-day'
import TaskDetailModal from '../widgets/academic/TaskDetailModal'
import MonthView from './MonthView'
import WeekView from './WeekView'
import DayGridView from './DayGridView'
import AgendaView from './AgendaView'
import DayDetailModal from './DayDetailModal'
import DayItemsList from './DayItemsList'
import RoutinesPanel from './routines/RoutinesPanel'
import RoutineInstanceModal from './routines/RoutineInstanceModal'
import TimeBlockWizardModal from './timeblock/TimeBlockWizardModal'
import type { CalendarEvent, DayItem, EventSpan } from './calendarItems'
import { groupItemsByDate, getBarSpans, addDaysToKey, formatDayHeading } from './calendarItems'
import { DEFAULT_PX_PER_MIN, MAX_PX_PER_MIN, MINUTES_PER_DAY, ZOOM_STEP } from './time-grid/grid-math'

type ViewMode = 'month' | 'week' | 'day' | 'routines'

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
  const [y, m] = dateKey.split('-').map(Number)
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
  return formatDayHeading(dateKey)
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

// Leave space for the app bar, calendar tools and week headers.
const RESERVED_CHROME_PX = 230
const MIN_GRID_CONTAINER_PX = 420
const SSR_FALLBACK_VIEWPORT_PX = RESERVED_CHROME_PX + MIN_GRID_CONTAINER_PX
const iconButtonClass = 'grid size-8 shrink-0 place-items-center rounded-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40'
const textButtonClass = 'rounded-md border border-outline-variant px-2.5 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container-high'
const panelClass = 'min-w-0 rounded-xl border border-outline-variant bg-surface-container-low'

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
  // Read only after mount (see effect below) — window isn't available
  // during SSR, so this fallback keeps the first client render matching
  // the server-rendered markup exactly.
  const [viewportH, setViewportH] = useState(SSR_FALLBACK_VIEWPORT_PX)
  const [selectedDateKey, setSelectedDateKey] = useState(() => todayKeyLondon())
  const [fetched, setFetched] = useState<{
    rangeStart: string
    rangeEnd: string
    events: CalendarEvent[]
    needsReconnect: boolean
    tasks: Task[]
    sessions: ActivitySession[]
    routineInstances: RoutineInstance[]
  } | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [monthDialogOpen, setMonthDialogOpen] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)
  const [selectedRoutineInstance, setSelectedRoutineInstance] = useState<RoutineInstance | null>(null)
  const [timeBlockOpen, setTimeBlockOpen] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const refetch = () => setRefreshToken((t) => t + 1)

  const maxContainerHeightPx = Math.max(MIN_GRID_CONTAINER_PX, viewportH - RESERVED_CHROME_PX)
  const fitPxPerMin = maxContainerHeightPx / MINUTES_PER_DAY
  const zoomMaxPxPerMin = Math.max(MAX_PX_PER_MIN, fitPxPerMin * 2)
  // The actual zoom level in effect: whatever the user picked, or the
  // readable default if they haven't touched the zoom.
  const pxPerMin = Math.min(zoomMaxPxPerMin, Math.max(fitPxPerMin, manualPxPerMin ?? DEFAULT_PX_PER_MIN))
  const setZoom = (next: number) => setManualPxPerMin(Math.min(zoomMaxPxPerMin, Math.max(fitPxPerMin, next)))

  useEffect(() => {
    const narrow = window.matchMedia('(width < 64rem)')
    const updateViewport = () => {
      setViewportH(window.innerHeight)
      setIsNarrow(narrow.matches)
      if (!narrow.matches) setMonthDialogOpen(false)
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  const { timeMin, timeMax, startDateKey, endDateKey } = getRangeForView(view, selectedDateKey)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetch(`/api/calendar/range?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`)
        .then(async (response) => {
          if (!response.ok) return { events: [], needsReconnect: response.status === 409 }
          const data = await response.json()
          return { events: (data.events ?? []) as CalendarEvent[], needsReconnect: false }
        })
        .catch(() => ({ events: [], needsReconnect: false })),
      supabase.from('tasks').select('*').gte('due_date', startDateKey).lt('due_date', endDateKey),
      supabase.from('activity_sessions').select('*').gte('occurred_at', timeMin).lt('occurred_at', timeMax),
      supabase.from('routine_instances').select('*').gte('start_at', timeMin).lt('start_at', timeMax),
    ]).then(([calendar, tasks, sessions, routines]) => {
      if (cancelled) return
      setFetched({
        rangeStart: timeMin,
        rangeEnd: timeMax,
        ...calendar,
        tasks: tasks.data ?? [],
        sessions: sessions.data ?? [],
        routineInstances: (routines.data ?? []) as RoutineInstance[],
      })
    })

    return () => {
      cancelled = true
    }
  }, [timeMin, timeMax, startDateKey, endDateKey, refreshToken])

  const current = fetched?.rangeStart === timeMin && fetched.rangeEnd === timeMax ? fetched : null
  const needsReconnect = fetched?.needsReconnect ?? false
  const timetable = useTimetable({ timeMin, timeMax })
  const work = useWorkItems()
  const spans = useMemo<EventSpan[]>(() => getBarSpans(current?.events ?? []), [current])
  const itemsByDate = useMemo(
    () => groupItemsByDate({
      events: current?.events ?? [],
      tasks: current?.tasks ?? [],
      sessions: current?.sessions ?? [],
      routineInstances: current?.routineInstances ?? [],
      timetable: timetable.sessions,
      tracked: timetable.tracked,
      deadlines: work.items,
    }),
    [current, timetable.sessions, timetable.tracked, work.items]
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
  const selectedItems: DayItem[] = itemsByDate.get(selectedDateKey) ?? []
  const showsGridOptions = view === 'day' || view === 'week'
  const itemActions = { onSelectTask: setSelectedTask, onSelectRoutineInstance: setSelectedRoutineInstance }
  const reconnect = () => connectGoogleCalendar('/calendar')
  const title = formatTitle(view, selectedDateKey)

  function renderView() {
    if (view === 'month') {
      return (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <MonthView
            year={year}
            month={month}
            itemsByDate={itemsByDate}
            spans={spans}
            todayKey={todayKey}
            selectedDateKey={selectedDateKey}
            onSelectDate={(dateKey) => {
              setSelectedDateKey(dateKey)
              setMonthDialogOpen(isNarrow)
            }}
          />
          <aside className={`${panelClass} hidden p-3 lg:block`} aria-labelledby="calendar-date-detail">
            <h2 id="calendar-date-detail" className="mb-2 rounded-md bg-primary-container/14 px-2.5 py-2 text-sm font-semibold text-primary">
              {formatDayHeading(selectedDateKey)}
            </h2>
            {current || selectedItems.length ? <DayItemsList items={selectedItems} {...itemActions} /> : <LoadingSkeleton label="Loading calendar" />}
          </aside>
        </div>
      )
    }

    if (view === 'week') {
      const monday = mondayOfWeek(selectedDateKey)
      if (gridMode === 'agenda') {
        return (
          <div className={`${panelClass} p-4`}>
            <AgendaView
              dateKeys={Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i))}
              itemsByDate={itemsByDate}
              todayKey={todayKey}
              {...itemActions}
            />
          </div>
        )
      }
      return (
        <WeekView
          mondayKey={monday}
          itemsByDate={itemsByDate}
          spans={spans}
          todayKey={todayKey}
          pxPerMin={pxPerMin}
          maxContainerHeightPx={maxContainerHeightPx}
          onSelectDate={(dateKey) => {
            setSelectedDateKey(dateKey)
            setView('day')
          }}
          {...itemActions}
        />
      )
    }

    if (view === 'routines') {
      return (
        <div className={`${panelClass} p-3`}>
          <RoutinesPanel dateKey={selectedDateKey} items={selectedItems} onScheduled={refetch} {...itemActions} />
        </div>
      )
    }

    const dueItems = selectedItems.filter((item) => item.kind === 'task' || item.kind === 'deadline')
    const scheduleItems = selectedItems.filter((item) => item.kind !== 'task' && item.kind !== 'deadline')
    return (
      <div className="grid items-start gap-3 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className={`${panelClass} p-3`} aria-labelledby="calendar-tasks">
          <h2 id="calendar-tasks" className="mb-2 flex items-center gap-2 border-b border-outline-variant pb-2 text-sm font-semibold text-on-surface">
            <ListTodo size={16} aria-hidden="true" />
            Tasks and deadlines
          </h2>
          {current || dueItems.length ? <DayItemsList items={dueItems} emptyMessage="No tasks or deadlines due." {...itemActions} /> : <LoadingSkeleton label="Loading tasks and deadlines" />}
          {selectedDateKey === todayKey && (
            <button
              type="button"
              onClick={() => setTimeBlockOpen(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-primary-container/14 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary-container/23"
            >
              <Wand2 size={15} aria-hidden="true" />
              Auto time-block today
            </button>
          )}
        </aside>
        {gridMode === 'agenda' ? (
          <section className={`${panelClass} p-4`} aria-labelledby="calendar-day-agenda">
            <h2 id="calendar-day-agenda" className="mb-2 border-b border-outline-variant pb-2 text-sm font-semibold text-on-surface">
              Schedule
            </h2>
            <DayItemsList items={scheduleItems} emptyMessage="Nothing scheduled." {...itemActions} />
          </section>
        ) : (
          <DayGridView
            dateKey={selectedDateKey}
            items={scheduleItems}
            isToday={selectedDateKey === todayKey}
            pxPerMin={pxPerMin}
            maxContainerHeightPx={maxContainerHeightPx}
            {...itemActions}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h1 className="sr-only">Calendar</h1>
      <div className={`${panelClass} flex flex-wrap items-center gap-x-4 gap-y-2 px-2.5 py-1.5`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-2 text-on-surface">
            <CalendarDays size={17} aria-hidden="true" />
            <h2 className="font-display text-sm font-semibold tabular-nums">{title}</h2>
          </div>
          <div className="flex items-center gap-0.5" role="group" aria-label="Date navigation">
            <button type="button" onClick={goPrev} aria-label="Previous" className={iconButtonClass}>
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={goToday} aria-label="Jump to today" className={textButtonClass}>
              Today
            </button>
            <button type="button" onClick={goNext} aria-label="Next" className={iconButtonClass}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 xl:ml-auto">
          <FilterTabs
            aria-label="Calendar view"
            size="compact"
            value={view}
            onChange={setView}
            options={VIEW_OPTIONS}
          />
          {showsGridOptions && gridMode === 'grid' && (
            <div className="flex items-center gap-0.5" role="group" aria-label="Hour grid scale">
              <button
                type="button"
                onClick={() => setZoom(pxPerMin / ZOOM_STEP)}
                disabled={pxPerMin <= fitPxPerMin}
                aria-label="Zoom out"
                className={iconButtonClass}
              >
                <ZoomOut size={15} />
              </button>
              <input
                type="range"
                min={fitPxPerMin}
                max={zoomMaxPxPerMin}
                step="any"
                value={pxPerMin}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Hour grid zoom"
                className="h-1.5 w-16 accent-primary-container"
              />
              <button
                type="button"
                onClick={() => setZoom(pxPerMin * ZOOM_STEP)}
                disabled={pxPerMin >= zoomMaxPxPerMin}
                aria-label="Zoom in"
                className={iconButtonClass}
              >
                <ZoomIn size={15} />
              </button>
              <button type="button" onClick={() => setZoom(fitPxPerMin)} className={textButtonClass}>
                Fit day
              </button>
            </div>
          )}
          {showsGridOptions && (
            <FilterTabs
              aria-label="Grid or agenda view"
              size="compact"
              value={gridMode}
              onChange={setGridMode}
              options={GRID_MODE_OPTIONS}
            />
          )}
          {!needsReconnect && (
            <button
              type="button"
              onClick={reconnect}
              aria-label="Reconnect Google Calendar"
              title="Reconnect Google Calendar"
              className={iconButtonClass}
            >
              <RefreshCw size={15} />
            </button>
          )}
        </div>
      </div>

      {needsReconnect && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface">
          <p role="status">Google Calendar is disconnected.</p>
          <button type="button" onClick={reconnect} className={`${textButtonClass} flex items-center gap-2 bg-surface-container-low`}>
            <RefreshCw size={14} aria-hidden="true" />
            Reconnect Google Calendar
          </button>
        </div>
      )}
      {renderView()}

      {view === 'month' && isNarrow && monthDialogOpen && (
        <DayDetailModal
          dateKey={selectedDateKey}
          items={selectedItems}
          onClose={() => setMonthDialogOpen(false)}
          onSelectTask={(task) => {
            setMonthDialogOpen(false)
            setSelectedTask(task)
          }}
          onSelectRoutineInstance={(instance) => {
            setMonthDialogOpen(false)
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
    </div>
  )
}
