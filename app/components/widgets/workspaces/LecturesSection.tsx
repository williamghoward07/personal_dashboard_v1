'use client'

import { useMemo, useState } from 'react'
import { Presentation } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { ACCENT_BAR } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'
import type { WorkspaceLink } from '@/lib/types'
import type { WorkspaceLinkPatch } from '@/lib/workspaces/use-workspace-links'
import { useWorkItems } from '@/lib/blackboard/use-work-items'
import { useTimetable } from '@/lib/lectures/use-timetable'
import { notifyLecturesChanged } from '@/lib/lectures/events'
import { PREP_ACCENT, formatSessionDay, formatSessionTime } from '@/lib/timetable/format'
import {
  addCounts,
  countByStatus,
  hasEnded,
  postStatus,
  prepStatus,
  splitByTime,
  type PrepStatus,
  type SessionWithPrep,
} from '@/lib/timetable/session'
import WorkList from '../../lectures/WorkList'
import { inputClass, microLabelClass, wsAccentStyle } from './shared'

function StatusCounts({ counts }: { counts: Record<PrepStatus, number> }) {
  return (
    <span className="flex items-center gap-2.5 text-[11px] tabular-nums text-on-surface-variant">
      {(['red', 'amber', 'green'] as const).map((status) => (
        <span key={status} className="flex items-center gap-1" title={`${counts[status]} upcoming ${status}`}>
          <span className={cn('h-2 w-2 rounded-full', ACCENT_BAR[PREP_ACCENT[status]])} aria-hidden />
          {counts[status]}
          <span className="sr-only">{status}</span>
        </span>
      ))}
    </span>
  )
}

// A module workspace's key dates: every piece of work for its module code
// (lecture prep, assignments, AI-found dates), in the same Upcoming / Past
// due / Completed list as /lectures, with the module locked. Reading counts come from this page's own
// link state, so Sources, stats and this section always agree; task counts
// and hand-in state come from the timetable fetch.
export default function LecturesSection({
  moduleCode,
  links,
  updateLink,
}: {
  moduleCode: string
  links: WorkspaceLink[]
  updateLink: (id: string, patch: WorkspaceLinkPatch) => Promise<void>
}) {
  const { sessions: all, loading, error, setupNeeded } = useTimetable()
  const work = useWorkItems()
  const [now] = useState(() => new Date())

  const sessions = useMemo(() => all.filter((s) => s.moduleCode === moduleCode), [all, moduleCode])
  const uids = useMemo(() => new Set(sessions.map((s) => s.uid)), [sessions])

  const readingsBySession = useMemo(() => {
    const map = new Map<string, WorkspaceLink[]>()
    for (const link of links) {
      if (!link.session_uid) continue
      const list = map.get(link.session_uid)
      if (list) list.push(link)
      else map.set(link.session_uid, [link])
    }
    return map
  }, [links])

  // Readings not (or no longer) tied to one of this module's sessions.
  const unassigned = links.filter(
    (l) => (l.is_reading || l.week != null || l.session_uid) && (!l.session_uid || !uids.has(l.session_uid))
  )

  const live: SessionWithPrep[] = useMemo(
    () =>
      sessions.map((s) => {
        const readings = readingsBySession.get(s.uid) ?? []
        const linkCount = {
          done: readings.filter((r) => r.completed_at).length,
          total: readings.length,
        }
        return {
          ...s,
          readings: linkCount,
          status: prepStatus(addCounts(linkCount, s.tasks.prep), s.prepDone),
          postStatus: postStatus(s.tasks.post, s.notesDone, s.prepDone, hasEnded(s, now)),
        }
      }),
    [sessions, readingsBySession, now]
  )
  const { upcoming, past } = splitByTime(live, now)

  // Prep and test rows take this page's own reading counts (`live`), so
  // Sources, stats and this list agree between refetches.
  const liveByUid = useMemo(() => new Map(live.map((s) => [s.uid, s])), [live])
  const items = useMemo(
    () => work.items.map((item) => (item.session ? { ...item, session: liveByUid.get(item.session.uid) ?? item.session } : item)),
    [work.items, liveByUid]
  )

  const afterWrite = <T,>(promise: Promise<T>) =>
    promise.then((result) => {
      notifyLecturesChanged()
      return result
    })

  const upcomingCounts = countByStatus(upcoming)

  return (
    <ModuleGlassCard style={wsAccentStyle} size="sm" className="flex flex-col gap-3">
      {error === 'not_configured' && (
        <p className="text-sm text-on-surface-variant">
          The timetable isn&apos;t connected — set <code>TIMETABLE_ICS_URL</code> (see the Lectures tab).
        </p>
      )}
      {error === 'failed' && <p className="text-sm text-on-surface-variant">Couldn&apos;t load the timetable.</p>}
      {setupNeeded && (
        <p className="text-sm text-on-surface-variant">
          Apply <code>20261019000000_lecture_sessions.sql</code> so prep can be saved.
        </p>
      )}

      {unassigned.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-outline-variant p-2.5">
          <span className={microLabelClass}>Readings not assigned to a session ({unassigned.length})</span>
          <ul className="flex flex-col gap-1">
            {unassigned.map((link) => (
              <li key={link.id} className="flex items-center gap-2 text-sm">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-on-surface hover:underline"
                >
                  {link.title}
                  {link.week != null && (
                    <span className="ml-1.5 text-xs text-on-surface-variant">week {link.week}</span>
                  )}
                </a>
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return
                    void afterWrite(
                      updateLink(
                        link.id,
                        e.target.value === '__source'
                          ? { is_reading: false, session_uid: null, week: null }
                          : { is_reading: true, session_uid: e.target.value }
                      )
                    )
                  }}
                  aria-label={`Assign ${link.title} to a session`}
                  className={cn(inputClass, 'max-w-56 py-1 text-xs')}
                >
                  <option value="">Assign to…</option>
                  {upcoming.length > 0 && (
                    <optgroup label="Upcoming">
                      {upcoming.map((s) => (
                        <option key={s.uid} value={s.uid}>
                          {formatSessionDay(s.start)} {formatSessionTime(s)} · {s.type}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {past.length > 0 && (
                    <optgroup label="Earlier">
                      {past.map((s) => (
                        <option key={s.uid} value={s.uid}>
                          {formatSessionDay(s.start)} {formatSessionTime(s)} · {s.type}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="__source">Not a reading (make it a source)</option>
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      <WorkList
        items={items}
        now={now}
        accent="ws"
        loading={loading || work.loading}
        error={work.error}
        lockedModule={moduleCode}
        title={
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-on-surface">
            <Presentation className="h-4 w-4 text-ws-accent" strokeWidth={1.75} />
            Key dates
            <span className="font-mono text-[11px] font-normal text-on-surface-variant">{moduleCode}</span>
            {upcoming.length > 0 && <StatusCounts counts={upcomingCounts} />}
          </h2>
        }
      />
    </ModuleGlassCard>
  )
}
