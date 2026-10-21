'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Presentation } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { ACCENT_BAR } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'
import type { WorkspaceLink } from '@/lib/types'
import type { AddLinkOptions, WorkspaceLinkPatch } from '@/lib/workspaces/use-workspace-links'
import { useTimetable } from '@/lib/lectures/use-timetable'
import { notifyLecturesChanged } from '@/lib/lectures/events'
import { saveSessionState, type SessionStatePatch } from '@/lib/lectures/prep-writes'
import { PREP_ACCENT, formatSessionDay, formatSessionTime } from '@/lib/timetable/format'
import {
  countByStatus,
  prepStatus,
  splitByTime,
  type PrepStatus,
  type SessionWithPrep,
} from '@/lib/timetable/session'
import SessionPrepPanel, { type SessionPrepState } from '../../lectures/SessionPrepPanel'
import SessionRow from '../../lectures/SessionRow'
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

// A module workspace's timetable: every session for its module code, with
// its readings (links with that session_uid) ticked off in place. Readings
// come from this page's own link state, so Sources, stats and this section
// always agree; notes / "no readings" are saved to lecture_sessions.
export default function LecturesSection({
  moduleCode,
  links,
  addLink,
  updateLink,
  deleteLink,
}: {
  moduleCode: string
  links: WorkspaceLink[]
  addLink: (rawUrl: string, options?: AddLinkOptions) => Promise<WorkspaceLink | null>
  updateLink: (id: string, patch: WorkspaceLinkPatch) => Promise<void>
  deleteLink: (id: string) => Promise<void>
}) {
  const { sessions: all, loading, error, setupNeeded } = useTimetable()
  const [now] = useState(() => new Date())
  const [expandedUid, setExpandedUid] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)
  // Saved state shown before the timetable refetch lands.
  const [overrides, setOverrides] = useState<Map<string, Partial<SessionPrepState>>>(new Map())
  const [saveError, setSaveError] = useState<string | null>(null)

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

  const stateOf = (s: SessionWithPrep): SessionPrepState => ({
    noReadings: s.noReadings,
    notesDone: s.notesDone,
    note: s.note,
    ...overrides.get(s.uid),
  })

  const live = sessions.map((s) => {
    const readings = readingsBySession.get(s.uid) ?? []
    const state = stateOf(s)
    const count = { done: readings.filter((r) => r.completed_at).length, total: readings.length }
    return { session: s, readings, state, count, status: prepStatus(count, state.noReadings) }
  })
  const { upcoming, past } = splitByTime(
    live.map((l) => ({ ...l.session, live: l })),
    now
  )

  const saveState = async (session: SessionWithPrep, patch: SessionStatePatch) => {
    const local: Partial<SessionPrepState> = {}
    if ('no_readings' in patch) local.noReadings = !!patch.no_readings
    if ('notes_done_at' in patch) local.notesDone = !!patch.notes_done_at
    if ('note' in patch) local.note = patch.note ?? null
    const previous = overrides.get(session.uid)
    setOverrides((prev) => new Map(prev).set(session.uid, { ...prev.get(session.uid), ...local }))
    setSaveError(null)
    try {
      await saveSessionState(session, patch)
      notifyLecturesChanged()
    } catch (err) {
      setOverrides((prev) => {
        const next = new Map(prev)
        if (previous) next.set(session.uid, previous)
        else next.delete(session.uid)
        return next
      })
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const afterWrite = <T,>(promise: Promise<T>) =>
    promise.then((result) => {
      notifyLecturesChanged()
      return result
    })

  const renderRow = (entry: (typeof live)[number]) => (
    <SessionRow
      key={entry.session.uid}
      session={entry.session}
      status={entry.status}
      readings={entry.count}
      notesDone={entry.state.notesDone}
      expanded={expandedUid === entry.session.uid}
      onToggle={() => setExpandedUid((uid) => (uid === entry.session.uid ? null : entry.session.uid))}
    >
      <SessionPrepPanel
        session={entry.session}
        readings={entry.readings}
        state={entry.state}
        accent="ws"
        showHeader={false}
        onAddReading={(url) => afterWrite(addLink(url, { sessionUid: entry.session.uid }))}
        onToggleReading={(link) =>
          void afterWrite(updateLink(link.id, { completed_at: link.completed_at ? null : new Date().toISOString() }))
        }
        onRenameReading={(id, title) => void updateLink(id, { title })}
        onRemoveReading={(id) => void afterWrite(deleteLink(id))}
        onSaveState={(patch) => void saveState(entry.session, patch)}
      />
    </SessionRow>
  )

  const upcomingCounts = countByStatus(upcoming.map((s) => s.live))

  return (
    <ModuleGlassCard style={wsAccentStyle} size="sm" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-on-surface">
          <Presentation className="h-4 w-4 text-ws-accent" strokeWidth={1.75} />
          Lectures
          <span className="font-mono text-[11px] font-normal text-on-surface-variant">{moduleCode}</span>
        </h2>
        {upcoming.length > 0 && <StatusCounts counts={upcomingCounts} />}
      </div>

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
      {saveError && (
        <p role="alert" className="text-sm text-error">
          {saveError}
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
                  {link.week != null && <span className="ml-1.5 text-xs text-on-surface-variant">week {link.week}</span>}
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

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading timetable…</p>
      ) : !error && sessions.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No sessions for {moduleCode} on the timetable.</p>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <ul className="flex flex-col gap-0.5">{upcoming.map((s) => renderRow(s.live))}</ul>
          ) : (
            !error && <p className="text-sm text-on-surface-variant">No more sessions this term.</p>
          )}

          {past.length > 0 && (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setShowPast((v) => !v)}
                aria-expanded={showPast}
                className="flex items-center gap-2 text-left"
              >
                <ChevronDown
                  className={cn('h-3 w-3 text-on-surface-variant transition-transform', showPast ? '' : '-rotate-90')}
                />
                <span className={microLabelClass}>Earlier ({past.length})</span>
                <span className="text-[11px] text-on-surface-variant">
                  notes taken for {past.filter((s) => s.live.state.notesDone).length}/{past.length}
                </span>
              </button>
              {showPast && <ul className="flex flex-col gap-0.5">{past.map((s) => renderRow(s.live))}</ul>}
            </div>
          )}
        </>
      )}
    </ModuleGlassCard>
  )
}
