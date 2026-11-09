'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { ACCENT_TEXT, type UiAccent } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'
import { saveSessionState, type SessionStatePatch } from '@/lib/lectures/prep-writes'
import { notifyLecturesChanged } from '@/lib/lectures/events'
import { addCounts, assignmentLists, type AssignmentTab, type SessionWithPrep } from '@/lib/timetable/session'
import { formatSessionDay } from '@/lib/timetable/format'
import HandInButton, { CONFIRM_MS } from './HandInButton'
import SessionRow from './SessionRow'

const DAY_MS = 24 * 60 * 60 * 1000
const LIST_LIMIT = 20

const TAB_LABEL: Record<AssignmentTab, string> = {
  upcoming: 'Upcoming',
  pastDue: 'Past due',
  completed: 'Completed',
  history: 'History',
}

const TAB_EMPTY: Record<AssignmentTab, string> = {
  upcoming: 'Nothing left to hand in.',
  pastDue: 'Nothing past due.',
  completed: 'Nothing marked as done yet.',
  history: 'No past or handed-in sessions yet.',
}

/** "Due yesterday" / "Due 3 days ago" — from the session's end, as the Teams past-due list does. */
function overdueLabel(session: SessionWithPrep, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(session.end ?? session.start).getTime()) / DAY_MS)
  if (days < 1) return 'Due today'
  return days === 1 ? 'Due yesterday' : `Due ${days} days ago`
}

/** What stands between an overdue session and green. Follow-up never makes it overdue. */
function outstanding(session: SessionWithPrep): string {
  const prep = addCounts(session.readings, session.tasks.prep)
  if (session.status === 'red') return 'no prep added'
  const left = prep.total - prep.done
  return left > 0 ? `${left} prep left` : 'not marked as done'
}

/**
 * Module sessions as Teams lists assignments: Upcoming / Past due /
 * Completed / History, with Mark as done right on past-due rows. Used by
 * /lectures (every module, filterable) and a module workspace (one module).
 * Past due = ended and not handed in; follow-up never counts. Uncoded
 * events are never listed.
 */
export default function SessionAssignmentsList({
  sessions,
  now,
  accent,
  loading,
  showModule,
  title,
  filters,
}: {
  sessions: SessionWithPrep[]
  /** Fixed by the caller: "now" shouldn't re-sort rows mid-click. */
  now: Date
  accent: UiAccent
  loading: boolean
  showModule: boolean
  /** Left of the tabs in the header. */
  title: ReactNode
  /** A row between the header and the list (e.g. a module filter). */
  filters?: ReactNode
}) {
  const [tab, setTab] = useState<AssignmentTab>('upcoming')
  const [showAll, setShowAll] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  const lists = useMemo(() => assignmentLists(sessions, now), [sessions, now])
  const tabList = lists[tab]
  const shown = showAll ? tabList : tabList.slice(0, LIST_LIMIT)

  // Hand in from the past-due list without opening the session. The
  // refetch waits for the button's confirmation, or the row would vanish
  // mid-animation.
  const quickComplete = async (s: SessionWithPrep, patch: SessionStatePatch) => {
    setCompleteError(null)
    try {
      await Promise.all([saveSessionState(s, patch), new Promise((resolve) => setTimeout(resolve, CONFIRM_MS))])
      notifyLecturesChanged()
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const row = (session: SessionWithPrep) => {
    const pastDue = !session.prepDone && new Date(session.end ?? session.start).getTime() < now.getTime()
    return (
      <SessionRow
        key={session.uid}
        session={session}
        status={session.status}
        postStatus={session.postStatus}
        prep={addCounts(session.readings, session.tasks.prep)}
        showModule={showModule}
        aside={
          pastDue ? (
            <span className="flex w-44 shrink-0 flex-col items-end text-right leading-tight">
              <span className={cn('text-[11px] font-semibold', ACCENT_TEXT.crimson)}>{overdueLabel(session, now)}</span>
              <span className="truncate text-[11px] text-on-surface-variant">{outstanding(session)}</span>
            </span>
          ) : session.prepDone ? (
            <span className={cn('w-44 shrink-0 text-right text-[11px] font-semibold', ACCENT_TEXT.mint)}>
              Done{session.prepDoneAt ? ` ${formatSessionDay(session.prepDoneAt)}` : ''}
            </span>
          ) : null
        }
        action={
          pastDue && (
            <HandInButton prepDone={false} accent={accent} onSaveState={(patch) => void quickComplete(session, patch)} />
          )
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title}
        <FilterTabs
          size="compact"
          accent={tab === 'pastDue' ? 'crimson' : accent}
          aria-label="Show sessions"
          value={tab}
          onChange={(value) => {
            setTab(value)
            setShowAll(false)
          }}
          options={(Object.keys(TAB_LABEL) as AssignmentTab[]).map((value) => ({
            value,
            label: TAB_LABEL[value],
            count: lists[value].length,
          }))}
        />
      </div>
      {filters}
      {completeError && (
        <p role="alert" className="text-xs text-error">
          {completeError}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : tabList.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{TAB_EMPTY[tab]}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">{shown.map(row)}</ul>
      )}
      {tabList.length > shown.length && (
        <Button variant="ghost" size="sm" accent={accent} className="self-start" onClick={() => setShowAll(true)}>
          Show all {tabList.length}
        </Button>
      )}
    </div>
  )
}
