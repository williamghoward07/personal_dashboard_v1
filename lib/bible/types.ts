// Mirrors supabase/migrations/20260822000000_bible_schema.sql exactly.
// Kept separate from the shared lib/types.ts (this session's scope is
// limited to app/bible/**, lib/bible/**, supabase/migrations/**, CLAUDE.md).

export interface BiblePassage {
  id: string
  book: string
  book_order: number
  chapter: number
  verse_start: number | null
  verse_end: number | null
  created_at: string
}

export type BibleStudyStatus = 'active' | 'completed' | 'archived'

export interface BibleStudy {
  id: string
  title: string
  description: string | null
  status: BibleStudyStatus
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface BibleStudySession {
  id: string
  study_id: string
  session_number: number
  passage_id: string
  title: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface BibleSessionQuestion {
  id: string
  session_id: string
  position: number
  question_text: string
  answer_text: string | null
  answered_at: string | null
  created_at: string
}

export interface BiblePassageNote {
  id: string
  passage_id: string
  session_id: string | null
  note_text: string
  created_at: string
}

export interface BibleTopic {
  id: string
  slug: string
  label: string
  sort_order: number
  created_at: string
}

export interface BibleTopicPassage {
  id: string
  topic_id: string
  passage_id: string
  reason: string
  sort_order: number
  created_at: string
}

export interface BibleDailyVerse {
  id: string
  passage_id: string
  sort_order: number
  created_at: string
}

// Shape of the JSON pasted into the study-import textarea. See
// import_bible_study() in 20260822000100_bible_functions.sql for the
// server-side contract this must match.
export interface BibleStudyImportPassage {
  book: string
  chapter: number
  verse_start?: number | null
  verse_end?: number | null
}

export interface BibleStudyImportSession {
  title?: string | null
  passage: BibleStudyImportPassage
  questions: string[]
}

export interface BibleStudyImportPayload {
  title: string
  description?: string | null
  sessions: BibleStudyImportSession[]
}
