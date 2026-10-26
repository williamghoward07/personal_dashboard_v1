'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarClock, ClipboardList, FolderPlus, GraduationCap } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { Button } from '@/components/ui/button'
import { CountBadge } from '@/components/ui/count-badge'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { ACCENT_BAR, ACCENT_TEXT } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'
import { useTimetable } from '@/lib/lectures/use-timetable'
import { ensureModuleWorkspace, saveSessionState, type SessionStatePatch } from '@/lib/lectures/prep-writes'
import { notifyLecturesChanged } from '@/lib/lectures/events'
import { useWorkspaces } from '@/lib/workspaces/use-workspaces'
import {
  addCounts,
  assignmentLists,
  countByStatus,
  groupByModule,
  splitByTime,
  type AssignmentTab,
  type PrepStatus,
  type SessionWithPrep,
} from '@/lib/timetable/session'
import { PREP_ACCENT, formatSessionDay, formatSessionTime } from '@/lib/timetable/format'
import HandInButton, { CONFIRM_MS } from './HandInButton'
import SessionRow from './SessionRow'

const ACCENT = 'orange'
const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
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
const microLabel = 'font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/70'

function StatusCounts({ counts }: { counts: Record<PrepStatus, number> }) {
  return (
    <span className="flex items-center gap-2.5 text-[11px] tabular-nums text-on-surface-variant">
      {(['red', 'amber', 'green'] as const).map((status) => (
        <span key={status} className="flex items-center gap-1" title={`${counts[status]} ${status}`}>
          <span className={cn('h-2 w-2 rounded-full', ACCENT_BAR[PREP_ACCENT[status]])} aria-hidden />
          {counts[status]}
          <span className="sr-only">{status}</span>
        </span>
      ))}
    </span>
  )
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

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ModuleGlassCard accent={ACCENT} size="sm" className="flex flex-col gap-1.5">
      <h2 className="font-display text-sm font-semibold text-on-surface">{title}</h2>
      <div className="text-sm text-on-surface-variant">{children}</div>
    </ModuleGlassCard>
  )
}

// /lectures: every timetable session's prep at a glance. "Next 7 days" is
// what needs doing now; below, one card per module (from the timetable's
// module codes) linking to its module workspace, where readings live.
export default function LecturesBoard() {
  const router = useRouter()
  const { sessions, loading, error, setupNeeded } = useTimetable()
  const { workspaces } = useWorkspaces()
  const [tab, setTab] = useState<AssignmentTab>('upcoming')
  const [showAll, setShowAll] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [creating, setCreating] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  // Fixed for the page's lifetime: "now" shouldn't re-sort rows mid-click.
  const [now] = useState(() => new Date())

  const nextWeek = useMemo(() => {
    const { upcoming } = splitByTime(sessions, now)
    const limit = now.getTime() + WEEK_MS
    return upcoming.filter((s) => new Date(s.start).getTime() < limit)
  }, [sessions, now])

  // Module sessions as Teams lists assignments. Past due = ended and not
  // handed in; follow-up never counts. Uncoded events (inductions,
  // welcome talks) are never listed.
  const lists = useMemo(() => assignmentLists(sessions, now), [sessions, now])
  const tabList = lists[tab]
  const shown = showAll ? tabList : tabList.slice(0, LIST_LIMIT)

  const modules = useMemo(() => groupByModule(sessions), [sessions])
  const workspaceByCode = useMemo(
    () => new Map(workspaces.filter((w) => w.module_code && !w.archived_at).map((w) => [w.module_code as string, w])),
    [workspaces]
  )
  // Module workspaces whose code isn't on the timetable (e.g. last term's).
  const offTimetable = workspaces.filter(
    (w) => w.module_code && !w.archived_at && !modules.some((m) => m.code === w.module_code)
  )

  const createWorkspace = async (code: string, name: string) => {
    setCreating(code)
    setCreateError(null)
    try {
      router.push(`/workspaces/${await ensureModuleWorkspace(code, name)}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create the workspace')
      setCreating(null)
    }
  }

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

  const row = (session: SessionWithPrep, showModule: boolean, listed?: { now: Date }) => {
    const pastDue = !!listed && !session.prepDone && new Date(session.end ?? session.start).getTime() < listed.now.getTime()
    return (
    <SessionRow
      key={session.uid}
      session={session}
      status={session.status}
      postStatus={session.postStatus}
      prep={addCounts(session.readings, session.tasks.prep)}
      showModule={showModule}
      aside={
        listed &&
        (pastDue ? (
          <span className="flex w-44 shrink-0 flex-col items-end text-right leading-tight">
            <span className={cn('text-[11px] font-semibold', ACCENT_TEXT.crimson)}>{overdueLabel(session, listed.now)}</span>
            <span className="truncate text-[11px] text-on-surface-variant">{outstanding(session)}</span>
          </span>
        ) : session.prepDone ? (
          <span className={cn('w-44 shrink-0 text-right text-[11px] font-semibold', ACCENT_TEXT.mint)}>
            Done{session.prepDoneAt ? ` ${formatSessionDay(session.prepDoneAt)}` : ''}
          </span>
        ) : null)
      }
      action={
        pastDue && (
          <HandInButton prepDone={false} accent={ACCENT} onSaveState={(patch) => void quickComplete(session, patch)} />
        )
      }
    />
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-headline-lg font-bold text-academic-orange">Lectures</h1>
        <p className="text-sm text-on-surface-variant">
          Left half: prep before (red: nothing added · amber: not marked as done · green: done). Right half: follow-up,
          which opens once prep is marked as done (amber: concepts to review · green: done). Open a session to hand it in.
        </p>
      </div>

      {error === 'not_configured' && (
        <Notice title="Connect your timetable">
          Copy the calendar feed link from MyTimetable (Subscribe / Export — it ends in <code>.ics</code>) and set it as{' '}
          <code>TIMETABLE_ICS_URL</code> in <code>.env.local</code> (and on Vercel), then reload.
        </Notice>
      )}
      {error === 'failed' && (
        <Notice title="Couldn't load the timetable">
          The feed didn&apos;t respond. Check that <code>TIMETABLE_ICS_URL</code> is still valid.
        </Notice>
      )}
      {setupNeeded && (
        <Notice title="Prep isn't saved yet">
          Apply <code>supabase/migrations/20261019000000_lecture_sessions.sql</code> in the Supabase SQL editor — until
          then every light shows red and ticks won&apos;t save.
        </Notice>
      )}
      {createError && (
        <p role="alert" className="text-sm text-error">
          {createError}
        </p>
      )}

      {!error && (
        <ModuleGlassCard accent={ACCENT} size="sm" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-on-surface">
              <ClipboardList className="h-4 w-4 text-academic-orange" strokeWidth={1.75} />
              Assignments
              {lists.pastDue.length > 0 && <CountBadge accent="crimson" count={lists.pastDue.length} />}
            </h2>
            <FilterTabs
              size="compact"
              accent={tab === 'pastDue' ? 'crimson' : ACCENT}
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
            <ul className="flex flex-col gap-0.5">{shown.map((s) => row(s, true, { now }))}</ul>
          )}
          {tabList.length > shown.length && (
            <Button variant="ghost" size="sm" accent={ACCENT} className="self-start" onClick={() => setShowAll(true)}>
              Show all {tabList.length}
            </Button>
          )}
        </ModuleGlassCard>
      )}

      {!error && (
        <ModuleGlassCard accent={ACCENT} size="sm" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-on-surface">
              <CalendarClock className="h-4 w-4 text-academic-orange" strokeWidth={1.75} />
              Next 7 days
              <CountBadge accent={ACCENT} count={nextWeek.length} />
            </h2>
            <StatusCounts counts={countByStatus(nextWeek)} />
          </div>
          {loading ? (
            <p className="text-sm text-on-surface-variant">Loading…</p>
          ) : nextWeek.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Nothing on the timetable this week.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">{nextWeek.map((s) => row(s, true))}</ul>
          )}
        </ModuleGlassCard>
      )}

      {(modules.length > 0 || offTimetable.length > 0) && (
        <section className="flex flex-col gap-3">
          <span className={microLabel}>Modules</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => {
              const workspace = workspaceByCode.get(module.code)
              const { upcoming, past } = splitByTime(module.sessions, now)
              const next = upcoming[0]
              const followedUp = past.filter((s) => s.postStatus === 'green').length
              return (
                <ModuleGlassCard key={module.code} accent={ACCENT} size="sm" className="flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="font-mono text-[11px] text-on-surface-variant">{module.code}</span>
                      <h3 className="truncate font-display text-sm font-semibold text-on-surface">
                        {workspace?.title ?? module.name}
                      </h3>
                    </div>
                    <StatusCounts counts={countByStatus(upcoming)} />
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {next
                      ? `Next: ${next.type} · ${formatSessionDay(next.start)} ${formatSessionTime(next)}`
                      : 'No more sessions on the timetable'}
                  </p>
                  {past.length > 0 && (
                    <p className="text-xs text-on-surface-variant">
                      Follow-up done for {followedUp}/{past.length} past sessions
                    </p>
                  )}
                  {workspace ? (
                    <Link
                      href={`/workspaces/${workspace.id}`}
                      className="flex items-center gap-1 self-end text-xs font-semibold text-academic-orange hover:underline"
                    >
                      Open workspace
                      <ArrowRight className="h-3 w-3" strokeWidth={2} />
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      accent={ACCENT}
                      className="self-end"
                      disabled={creating !== null}
                      onClick={() => void createWorkspace(module.code, module.name)}
                    >
                      <FolderPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {creating === module.code ? 'Creating…' : 'Create workspace'}
                    </Button>
                  )}
                </ModuleGlassCard>
              )
            })}
            {offTimetable.map((workspace) => (
              <ModuleGlassCard key={workspace.id} accent={ACCENT} size="sm" className="flex flex-col gap-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="font-mono text-[11px] text-on-surface-variant">{workspace.module_code}</span>
                  <h3 className="truncate font-display text-sm font-semibold text-on-surface">{workspace.title}</h3>
                </div>
                <p className="text-xs text-on-surface-variant">Not on the current timetable.</p>
                <Link
                  href={`/workspaces/${workspace.id}`}
                  className="flex items-center gap-1 self-end text-xs font-semibold text-academic-orange hover:underline"
                >
                  Open workspace
                  <ArrowRight className="h-3 w-3" strokeWidth={2} />
                </Link>
              </ModuleGlassCard>
            ))}
          </div>
        </section>
      )}

      {!loading && !error && modules.length === 0 && offTimetable.length === 0 && (
        <Notice title="No modules found">
          <span className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" strokeWidth={1.75} />
            The timetable has no sessions with a module code (like GEOG1081) yet.
          </span>
        </Notice>
      )}
    </main>
  )
}
