import { supabase } from '@/lib/supabase'
import type { BiblePassage } from './types'

export interface PassageInput {
  book: string
  chapter: number
  verseStart?: number | null
  verseEnd?: number | null
}

// Looks up a passage by its natural key, creating it if it doesn't exist
// yet. Thin wrapper around the get_or_create_bible_passage() RPC — see
// supabase/migrations/20260822000100_bible_functions.sql — so passage
// dedup logic lives in exactly one place, reused by every write path
// (notes, topic links, daily verses) that needs a passage_id for a
// reference the user just typed. See passages.ts for the pure
// formatReference() half of this module.
export async function getOrCreatePassageId(input: PassageInput): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_bible_passage', {
    p_book: input.book,
    p_chapter: input.chapter,
    p_verse_start: input.verseStart ?? null,
    p_verse_end: input.verseEnd ?? null,
  })

  if (error) throw new Error(error.message)
  return data as string
}

// Fetches a passage row by id — needed wherever a page only has a
// passage_id on hand (a session's fixed passage, a topic-passage link) and
// has to render its book/chapter/verse reference via formatReference().
export async function getPassageById(id: string): Promise<BiblePassage | null> {
  const { data, error } = await supabase.from('bible_passages').select('*').eq('id', id).maybeSingle()

  if (error) throw new Error(error.message)
  return data as BiblePassage | null
}
