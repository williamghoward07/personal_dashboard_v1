'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarClock, FolderPlus, GraduationCap } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { Button } from '@/components/ui/button'
import { CountBadge } from '@/components/ui/count-badge'
import { ACCENT_BAR } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'
import { useTimetable } from '@/lib/lectures/use-timetable'
import { ensureModuleWorkspace } from '@/lib/lectures/prep-writes'
import { useWorkspaces } from '@/lib/workspaces/use-workspaces'
import { countByStatus, groupByModule, splitByTime, type PrepStatus, type SessionWithPrep } from '@/lib/timetable/session'
import { PREP_ACCENT, formatSessionDay, formatSessionTime } from '@/lib/timetable/format'
import ConnectedSessionPrep from './ConnectedSessionPrep'
import SessionRow from './SessionRow'

const ACCENT = 'orange'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
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
  const [expandedUid, setExpandedUid] = useState<string | null>(null)
  const [creating, setCreating] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  // Fixed for the page's lifetime: "now" shouldn't re-sort rows mid-click.
  const [now] = useState(() => new Date())

  const nextWeek = useMemo(() => {
    const { upcoming } = splitByTime(sessions, now)
    const limit = now.getTime() + WEEK_MS
    return upcoming.filter((s) => new Date(s.start).getTime() < limit)
  }, [sessions, now])

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

  const row = (session: SessionWithPrep, showModule: boolean) => (
    <SessionRow
      key={session.uid}
      session={session}
      status={session.status}
      readings={session.readings}
      notesDone={session.notesDone}
      showModule={showModule}
      expanded={expandedUid === session.uid}
      onToggle={() => setExpandedUid((uid) => (uid === session.uid ? null : session.uid))}
    >
      <ConnectedSessionPrep session={session} accent={ACCENT} showHeader={false} />
    </SessionRow>
  )

  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-headline-lg font-bold text-academic-orange">Lectures</h1>
        <p className="text-sm text-on-surface-variant">
          Red: no readings added · amber: readings to do · green: prepared. A tick means notes are taken.
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
              const notesTaken = past.filter((s) => s.notesDone).length
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
                      Notes taken for {notesTaken}/{past.length} past sessions
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
