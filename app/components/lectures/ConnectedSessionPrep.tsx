'use client'

import type { UiAccent } from '@/lib/theme'
import type { SessionWithPrep } from '@/lib/timetable/session'
import { useSessionPrep } from '@/lib/lectures/use-session-prep'
import SessionPrepPanel from './SessionPrepPanel'

/** SessionPrepPanel wired to its own data — for the calendar popover and /lectures. */
export default function ConnectedSessionPrep({
  session,
  accent = 'orange',
  showHeader = true,
}: {
  session: SessionWithPrep
  accent?: UiAccent
  showHeader?: boolean
}) {
  const prep = useSessionPrep(session)
  const workspaceId = prep.readings[0]?.workspace_id ?? session.workspaceId
  return (
    <SessionPrepPanel
      session={session}
      readings={prep.readings}
      state={{
        noReadings: prep.state?.no_readings ?? false,
        notesDone: !!prep.state?.notes_done_at,
        note: prep.state?.note ?? null,
      }}
      accent={accent}
      loading={prep.loading}
      error={prep.error}
      workspaceHref={workspaceId ? `/workspaces/${workspaceId}` : null}
      showHeader={showHeader}
      onAddReading={prep.addReading}
      onToggleReading={(link) => void prep.toggleReading(link)}
      onRenameReading={(id, title) => void prep.renameReading(id, title)}
      onRemoveReading={(id) => void prep.removeReading(id)}
      onSaveState={(patch) => void prep.saveState(patch)}
    />
  )
}
