import { supabase } from '@/lib/supabase'
import { londonDateKey } from '@/lib/google/london-day'
import { getDailyVerseIndex } from './daily-verse'
import type { BibleDailyVerse } from './types'

export async function listDailyVerses(): Promise<BibleDailyVerse[]> {
  const { data, error } = await supabase
    .from('bible_daily_verses')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as BibleDailyVerse[]
}

// Composed helper: today's curated entry, or null if the list is still
// empty (content not yet curated — see the seed migration's note).
// `now` is injectable for testing; defaults to the real current instant.
export async function getTodaysDailyVerse(now = new Date()): Promise<BibleDailyVerse | null> {
  const verses = await listDailyVerses()
  if (verses.length === 0) return null

  const todayKey = londonDateKey(now.toISOString())
  const index = getDailyVerseIndex(todayKey, verses.length)
  return verses[index]
}
