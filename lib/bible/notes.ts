import { supabase } from '@/lib/supabase'
import type { BiblePassageNote } from './types'

// The resurfacing query: every note ever written against this exact
// passage row, newest first — "opening a passage I've studied before must
// show what I wrote last time" (the module's core retention feature).
export async function getPassageNotes(passageId: string): Promise<BiblePassageNote[]> {
  const { data, error } = await supabase
    .from('bible_passage_notes')
    .select('*')
    .eq('passage_id', passageId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as BiblePassageNote[]
}

// Secondary, broader resurfacing: other notes in the same book+chapter but
// against a different verse range (e.g. a note on John 3:16 when opening
// John 3:1-21). Intentionally not verse-range-overlap matching — that would
// need containment queries and isn't what was asked for; this is the cheap,
// meaningfully-useful fallback layered on top of the exact match above.
export async function getChapterNotes(
  book: string,
  chapter: number,
  excludePassageId: string
): Promise<BiblePassageNote[]> {
  const { data, error } = await supabase
    .from('bible_passage_notes')
    .select('*, bible_passages!inner(book, chapter)')
    .eq('bible_passages.book', book)
    .eq('bible_passages.chapter', chapter)
    .neq('passage_id', excludePassageId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as BiblePassageNote[]
}

export interface NewNoteInput {
  passageId: string
  noteText: string
  sessionId?: string | null
}

export async function addNote(input: NewNoteInput): Promise<BiblePassageNote> {
  const { data, error } = await supabase
    .from('bible_passage_notes')
    .insert({
      passage_id: input.passageId,
      note_text: input.noteText,
      session_id: input.sessionId ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as BiblePassageNote
}
