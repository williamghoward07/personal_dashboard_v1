'use client'

import LiquidSwitch from '@/app/components/LiquidSwitch'
import type { Accent } from '@/lib/theme'
import type { SessionWithPrep } from '@/lib/timetable/session'
import { sessionHref, sessionMeta } from '@/lib/timetable/format'
import { useSessionPrep } from '@/lib/lectures/use-session-prep'
import { useSessionTasks } from '@/lib/lectures/use-session-tasks'
import SessionPrepPanel from './SessionPrepPanel'

const TRACK_OPTIONS = [
  { value: 'event', label: 'Normal event' },
  { value: 'prep', label: 'Track prep' },
] as const

/**
 * SessionPrepPanel wired to its own data — for the calendar popover and
 * /lectures. A Google event is a normal event until its switch turns prep
 * on; timetable sessions always have prep.
 */
export default function ConnectedSessionPrep({
  session,
  accent = 'orange',
  showHeader = true,
}: {
  session: SessionWithPrep
  accent?: Accent
  showHeader?: boolean
}) {
  const prep = useSessionPrep(session)
  const tasks = useSessionTasks(session.uid)
  const workspaceId = prep.readings[0]?.workspace_id ?? session.workspaceId
  const isEvent = session.source === 'calendar'
  // Live from the row, not `session`: the switch flips while the popover
  // still holds the session it was opened with.
  const tracked = isEvent ? (prep.loading ? session.tracked : !!prep.state?.tracked) : true

  const trackSwitch = isEvent && (
    <div className="flex flex-col gap-1">
      <LiquidSwitch
        options={TRACK_OPTIONS}
        value={tracked ? 'prep' : 'event'}
        accent={accent}
        onChange={(value) => void prep.saveState({ tracked: value === 'prep' })}
      />
      {!tracked && (
        <p className="text-xs text-on-surface-variant">
          Track prep to add tasks, readings and follow-up, with a traffic light on the calendar.
        </p>
      )}
    </div>
  )

  if (!tracked) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 pr-6">
          <p className="text-sm font-semibold text-on-surface">{session.title}</p>
          <p className="text-xs text-on-surface-variant">{sessionMeta(session)}</p>
        </div>
        {trackSwitch}
        {prep.error && (
          <p role="alert" className="text-xs text-error">
            {prep.error}
          </p>
        )}
      </div>
    )
  }

  return (
    <SessionPrepPanel
      session={session}
      readings={prep.readings}
      tasks={tasks.tasks}
      state={{
        prepDone: !!prep.state?.prep_done_at,
        notesDone: !!prep.state?.notes_done_at,
        note: prep.state?.note ?? null,
      }}
      accent={accent}
      loading={prep.loading || tasks.loading}
      error={prep.error ?? tasks.error}
      workspaceHref={workspaceId ? `/workspaces/${workspaceId}` : null}
      // Only timetable sessions: the view finds its session in the feed.
      fullViewHref={isEvent ? null : sessionHref(session.uid)}
      showHeader={showHeader}
      headerSlot={trackSwitch || undefined}
      // A module session files a pasted link in its workspace; anything
      // else keeps it as a task with a link.
      onAddReading={(url) => (session.moduleCode ? prep.addReading(url) : tasks.addTask('prep', { url }))}
      onToggleReading={(link) => void prep.toggleReading(link)}
      onRenameReading={(id, title) => void prep.renameReading(id, title)}
      onRemoveReading={(id) => void prep.removeReading(id)}
      onAddTask={(phase, title) => tasks.addTask(phase, { title })}
      onUpdateTask={(id, patch) => void tasks.updateTask(id, patch)}
      onRemoveTask={(id) => void tasks.removeTask(id)}
      onSaveState={(patch) => void prep.saveState(patch)}
    />
  )
}
