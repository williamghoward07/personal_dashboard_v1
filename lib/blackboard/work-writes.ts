'use client'

import { supabase } from '@/lib/supabase'
import { isDateKey } from './dates'
import { notifyWorkChanged } from './events'
import { BB_KEY_DATE_CATEGORIES, type BbKeyDateCategory } from './types'

// Dashboard-side writes for Blackboard work. Each returns { error } and
// notifies (notifyWorkChanged) on success. None of them writes a sync-owned
// column: only bb_key_dates, bb_assignments.done_at, bb_session_overrides and
// bb_content_ai.read_with_ai. Nothing here touches Blackboard itself.

export interface WriteResult {
  error: string | null
}

async function done(promise: PromiseLike<{ error: { message: string } | null }>): Promise<WriteResult> {
  const { error } = await promise
  if (error) return { error: error.message }
  notifyWorkChanged()
  return { error: null }
}

const now = () => new Date().toISOString()

// --------------------------------------------------------- AI key dates --

/** Accept an AI-found date as it is. */
export function confirmKeyDate(id: string): Promise<WriteResult> {
  return done(supabase.from('bb_key_dates').update({ status: 'confirmed', updated_at: now() }).eq('id', id))
}

export interface KeyDateEdit {
  due_on: string
  /** ISO instant; null clears the time. Omitted = left as is. */
  due_at?: string | null
  title?: string
  category?: BbKeyDateCategory
}

/**
 * Correct an AI-found date. Editing confirms it. `ai_due_on` (what the AI
 * originally said) is never touched.
 */
export async function editKeyDate(id: string, edit: KeyDateEdit): Promise<WriteResult> {
  if (!isDateKey(edit.due_on)) return { error: 'Not a valid date' }
  if (edit.due_at != null && Number.isNaN(Date.parse(edit.due_at))) return { error: 'Not a valid time' }
  if (edit.category !== undefined && !BB_KEY_DATE_CATEGORIES.includes(edit.category)) return { error: 'Unknown category' }
  const patch: Record<string, unknown> = { due_on: edit.due_on, status: 'confirmed', updated_at: now() }
  if (edit.due_at !== undefined) patch.due_at = edit.due_at
  if (edit.title !== undefined) {
    const title = edit.title.trim()
    if (!title) return { error: 'A title is required' }
    patch.title = title
  }
  if (edit.category !== undefined) patch.category = edit.category
  return done(supabase.from('bb_key_dates').update(patch).eq('id', id))
}

/** Hide an AI-found date for good (re-processing never brings it back). */
export function dismissKeyDate(id: string): Promise<WriteResult> {
  return done(supabase.from('bb_key_dates').update({ status: 'dismissed', updated_at: now() }).eq('id', id))
}

export function setKeyDateDone(id: string, isDone: boolean): Promise<WriteResult> {
  return done(supabase.from('bb_key_dates').update({ done_at: isDone ? now() : null, updated_at: now() }).eq('id', id))
}

// ------------------------------------------------- official assignments --

/** Mark as done for an assignment Blackboard can't see submitted. Writes `done_at` only. */
export function setAssignmentDone(id: string, isDone: boolean): Promise<WriteResult> {
  return done(supabase.from('bb_assignments').update({ done_at: isDone ? now() : null }).eq('id', id))
}

// ------------------------------------------------ lecture-page overrides --

function setOverride(sessionUid: string, contentId: string, action: 'hide' | 'attach'): Promise<WriteResult> {
  return done(
    supabase
      .from('bb_session_overrides')
      .upsert({ session_uid: sessionUid, content_id: contentId, action }, { onConflict: 'user_id,session_uid,content_id' })
  )
}

/** "Not relevant": hide this item on this session's page. */
export function hideForSession(sessionUid: string, contentId: string): Promise<WriteResult> {
  return setOverride(sessionUid, contentId, 'hide')
}

/** Show this item on this session's page even though matching didn't put it there. */
export function attachToSession(sessionUid: string, contentId: string): Promise<WriteResult> {
  return setOverride(sessionUid, contentId, 'attach')
}

/** Back to automatic matching for this item on this session. */
export function clearSessionOverride(sessionUid: string, contentId: string): Promise<WriteResult> {
  return done(supabase.from('bb_session_overrides').delete().eq('session_uid', sessionUid).eq('content_id', contentId))
}

// ---------------------------------------------------------- AI reading --

/** Ask (or stop asking) the AI to read this item for dates. Sets only `read_with_ai`. */
export function setReadWithAi(contentId: string, on: boolean): Promise<WriteResult> {
  return done(
    supabase
      .from('bb_content_ai')
      .upsert({ content_id: contentId, read_with_ai: on, updated_at: now() }, { onConflict: 'user_id,content_id' })
  )
}
