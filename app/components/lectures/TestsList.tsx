'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronRight, ClipboardCheck } from 'lucide-react'
import { CountBadge } from '@/components/ui/count-badge'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { StatusBadge } from '@/components/ui/status-badge'
import type { UiAccent } from '@/lib/theme'
import { formatSessionDay, formatSessionTime, sessionHref } from '@/lib/timetable/format'
import type { TimetableSession } from '@/lib/timetable/session'
import { collectTests, countdownLabel, daysUntil, splitTests, type TestEntry } from '@/lib/timetable/tests'

const DAY_MS = 24 * 60 * 60 * 1000
// Google's list is capped at 250 events per call, so the window is a term
// back and the rest of the year ahead rather than everything.
const LOOK_BACK_DAYS = 90
const LOOK_AHEAD_DAYS = 240

type TestsTab = 'upcoming' | 'past'

interface CalendarEventLike {
  id: string
  title: string
  allDay: boolean
  start: string
  end: string | null
}

/** Red inside a week, amber inside a fortnight, otherwise quiet. */
function countdownAccent(days: number): UiAccent {
  if (days <= 7) return 'crimson'
  if (days <= 14) return 'amber'
  return 'neutral'
}

function TestRow({ test, now, past }: { test: TestEntry; now: Date; past: boolean }) {
  const days = daysUntil(test, now)
  const body = (
    <>
      <span className="w-24 shrink-0 text-xs text-on-surface-variant">
        {formatSessionDay(test.allDay ? `${test.start.slice(0, 10)}T12:00:00Z` : test.start)}
      </span>
      <span className="w-24 shrink-0 font-mono text-[11px] tabular-nums text-on-surface-variant">
        {test.allDay ? 'All day' : formatSessionTime(test)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-on-surface">
        {test.moduleCode && (
          <span className="font-mono text-[11px] text-on-surface-variant">{test.moduleCode} </span>
        )}
        {test.title}
      </span>
      {test.location && (
        <span className="hidden shrink-0 text-xs text-on-surface-variant md:inline">{test.location}</span>
      )}
      {test.source === 'calendar' && (
        <span title="From Google Calendar" className="shrink-0 text-on-surface-variant">
          <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} aria-label="From Google Calendar" />
        </span>
      )}
      <span className="flex w-28 shrink-0 justify-end">
        {!past && (
          <StatusBadge size="sm" accent={countdownAccent(days)}>
            {countdownLabel(days)}
          </StatusBadge>
        )}
      </span>
    </>
  )

  return (
    <li>
      {test.source === 'timetable' ? (
        <Link
          href={sessionHref(test.id)}
          className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-container-high/60"
        >
          {body}
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" aria-hidden />
        </Link>
      ) : (
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          {body}
          <span className="w-3.5 shrink-0" aria-hidden />
        </div>
      )}
    </li>
  )
}

/**
 * /lectures' Tests tab: timetable sessions whose type is a test, plus
 * Google events whose title names a test or exam. Read-only — nothing to
 * hand in; a timetable test opens its session page for prep.
 */
export default function TestsList({
  sessions,
  now,
  accent,
  timetableLoading,
}: {
  sessions: TimetableSession[]
  /** Fixed by the caller, as for the assignments list. */
  now: Date
  accent: UiAccent
  timetableLoading: boolean
}) {
  const [tab, setTab] = useState<TestsTab>('upcoming')
  const [events, setEvents] = useState<CalendarEventLike[] | null>(null)
  const [calendarError, setCalendarError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({
      timeMin: new Date(now.getTime() - LOOK_BACK_DAYS * DAY_MS).toISOString(),
      timeMax: new Date(now.getTime() + LOOK_AHEAD_DAYS * DAY_MS).toISOString(),
    })
    fetch(`/api/calendar/range?${params}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) setCalendarError(true)
        setEvents((json.events ?? []) as CalendarEventLike[])
      })
      .catch(() => {
        if (!cancelled) {
          setCalendarError(true)
          setEvents([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [now])

  const { upcoming, past } = useMemo(() => splitTests(collectTests(sessions, events ?? []), now), [sessions, events, now])
  const list = tab === 'upcoming' ? upcoming : past
  const loading = timetableLoading || events === null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-on-surface">
          <ClipboardCheck className="h-4 w-4 shrink-0 text-academic-orange" strokeWidth={1.75} />
          Tests &amp; exams
          {upcoming.length > 0 && <CountBadge accent={accent} count={upcoming.length} />}
        </h2>
        <FilterTabs
          size="compact"
          accent={accent}
          aria-label="Show tests"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { value: 'past', label: 'Past', count: past.length },
          ]}
        />
      </div>
      {calendarError && (
        <p className="text-xs text-on-surface-variant">
          Google Calendar didn&apos;t load, so only timetable tests are shown.
        </p>
      )}
      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          {tab === 'upcoming' ? 'No tests coming up.' : 'No past tests.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {list.map((test) => (
            <TestRow key={test.id} test={test} now={now} past={tab === 'past'} />
          ))}
        </ul>
      )}
      <p className="text-[11px] text-on-surface-variant/70">
        From the timetable (sessions of type Test) and Google Calendar (events with test or exam in the title).
      </p>
    </div>
  )
}
