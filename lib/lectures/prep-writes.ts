'use client'

import { supabase } from '@/lib/supabase'
import type { LectureSession, SessionTask, WorkspaceLink } from '@/lib/types'
import type { TimetableSession } from '@/lib/timetable/session'
import { domainOf, resolveFaviconPath } from '@/lib/workspaces/favicon'
import { detectLinkKind } from '@/lib/workspaces/kinds'
import { normalizeUrl } from '@/lib/utils/url'
import { MODULE_WORKSPACE_HIDDEN } from './module-workspace'

// Writes shared by every place lecture prep can be edited (calendar
// popover, /lectures, a module workspace). Callers notify
// (notifyLecturesChanged) after a successful write.

export type SessionStatePatch = Partial<Pick<LectureSession, 'prep_done_at' | 'notes_done_at' | 'no_readings' | 'note' | 'tracked'>>

/** Hand prep in (Mark as done): the left half goes green and follow-up opens. */
export function handInPatch(): SessionStatePatch {
  return { prep_done_at: new Date().toISOString() }
}

/** Undo the hand-in. Also clears the retired "nothing to prepare" flag it was backfilled from. */
export const UNDO_HAND_IN: SessionStatePatch = { prep_done_at: null, no_readings: false }

/** The module workspace for `code`, created (title = module name) if there isn't one. */
export async function ensureModuleWorkspace(code: string, moduleName: string): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('module_code', code)
    .maybeSingle()
  if (findError) throw new Error(findError.message)
  if (existing) return existing.id as string

  const { data, error } = await supabase
    .from('workspaces')
    .insert({ title: moduleName, subtitle: code, module_code: code, hidden_sections: MODULE_WORKSPACE_HIDDEN })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create the module workspace')
  return data.id as string
}

/** Adds a reading for one session. Returns the row, or throws. */
export async function insertSessionReading(
  workspaceId: string,
  sessionUid: string,
  rawUrl: string,
  position: number
): Promise<WorkspaceLink> {
  const url = normalizeUrl(rawUrl)
  if (!url) throw new Error('Not a valid URL')

  const { data, error } = await supabase
    .from('workspace_links')
    .insert({
      workspace_id: workspaceId,
      title: domainOf(url),
      url,
      position,
      kind: detectLinkKind(url),
      is_reading: true,
      session_uid: sessionUid,
    })
    .select()
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to add reading')

  const created = data as WorkspaceLink
  // Decorative, fire-and-forget — same as useWorkspaceLinks.addLink.
  void resolveFaviconPath(url).then((path) => {
    if (path) void supabase.from('workspace_links').update({ favicon_path: path }).eq('id', created.id)
  })
  return created
}

/**
 * Adds a task (or, with a url, a reading) to one session. A link with no
 * title is titled by its domain, like a pasted workspace reading.
 */
export async function insertSessionTask(
  sessionUid: string,
  phase: SessionTask['phase'],
  input: { title?: string; url?: string | null },
  position: number
): Promise<SessionTask> {
  const url = input.url ? normalizeUrl(input.url) : null
  if (input.url && !url) throw new Error('Not a valid URL')
  const title = input.title?.trim() || (url ? domainOf(url) : '')
  if (!title) throw new Error('A task needs a title')

  const { data, error } = await supabase
    .from('session_tasks')
    .insert({ session_uid: sessionUid, phase, title, url, position })
    .select()
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to add')
  return data as SessionTask
}

/** Creates or updates the lecture_sessions row for `session`. */
export async function saveSessionState(
  session: Pick<TimetableSession, 'uid' | 'moduleCode' | 'title' | 'start'>,
  patch: SessionStatePatch
): Promise<LectureSession> {
  const { data, error } = await supabase
    .from('lecture_sessions')
    .upsert(
      { uid: session.uid, module_code: session.moduleCode, title: session.title, starts_at: session.start, ...patch },
      { onConflict: 'user_id,uid' }
    )
    .select()
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to save')
  return data as LectureSession
}
