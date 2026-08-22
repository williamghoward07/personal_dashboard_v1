import { supabase } from '@/lib/supabase'
import type { BibleSessionQuestion, BibleStudy, BibleStudyImportPayload, BibleStudySession } from './types'

// The one study currently in progress, or null if none — enforced at the
// database level by bible_studies_one_active_idx (a partial unique index
// on status='active'), not just by this query's shape.
export async function getActiveStudy(): Promise<BibleStudy | null> {
  const { data, error } = await supabase
    .from('bible_studies')
    .select('*')
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as BibleStudy | null
}

// Fetches one session by id — the session detail page only has a
// sessionId (from the route), not the parent studyId, so this is the
// entry point that loads everything else about that session.
export async function getSession(sessionId: string): Promise<BibleStudySession | null> {
  const { data, error } = await supabase.from('bible_study_sessions').select('*').eq('id', sessionId).maybeSingle()

  if (error) throw new Error(error.message)
  return data as BibleStudySession | null
}

export async function listSessions(studyId: string): Promise<BibleStudySession[]> {
  const { data, error } = await supabase
    .from('bible_study_sessions')
    .select('*')
    .eq('study_id', studyId)
    .order('session_number', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as BibleStudySession[]
}

export async function listSessionQuestions(sessionId: string): Promise<BibleSessionQuestion[]> {
  const { data, error } = await supabase
    .from('bible_session_questions')
    .select('*')
    .eq('session_id', sessionId)
    .order('position', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as BibleSessionQuestion[]
}

// Saves one question's answer and stamps answered_at — the per-question
// completion signal that makes pausing mid-session and resuming later work
// with no separate "session progress" bookkeeping (see the schema
// migration's comment on bible_session_questions).
export async function answerQuestion(questionId: string, answerText: string): Promise<void> {
  const { error } = await supabase
    .from('bible_session_questions')
    .update({ answer_text: answerText, answered_at: new Date().toISOString() })
    .eq('id', questionId)

  if (error) throw new Error(error.message)
}

// Marks a session done — either called once every question in it has been
// answered, or manually if the user chooses to close it out early.
export async function completeSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('bible_study_sessions')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)
}

export class ActiveStudyExistsError extends Error {
  constructor() {
    super('You already have an active study. Complete or archive it before starting a new one.')
    this.name = 'ActiveStudyExistsError'
  }
}

// Thin wrapper around the import_bible_study() RPC — see
// supabase/migrations/20260822000100_bible_functions.sql for the atomic
// study+sessions+questions creation this delegates to. Translates the
// bible_studies_one_active_idx unique-violation into a friendly error the
// import textarea's UI (deferred) can show directly.
export async function importStudy(payload: BibleStudyImportPayload): Promise<string> {
  const { data, error } = await supabase.rpc('import_bible_study', { p_study: payload })

  if (error) {
    if (error.code === '23505') throw new ActiveStudyExistsError()
    throw new Error(error.message)
  }

  return data as string
}
