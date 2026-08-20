import { supabase } from '@/lib/supabase'
import type { BibleTopic, BibleTopicPassage } from './types'

// The topical index's tap 1: the fixed list of struggles (anxiety, grief,
// doubt, ...). Seeded structurally in
// supabase/migrations/20260822000200_bible_topics_seed.sql.
export async function listTopics(): Promise<BibleTopic[]> {
  const { data, error } = await supabase.from('bible_topics').select('*').order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as BibleTopic[]
}

// Tap 2: the 5-8 curated passages + one-line reasons for a given topic.
// Single indexed query (bible_topic_passages_topic_idx) — the "two taps,
// zero typing, zero waiting" requirement is a UI-latency concern this
// query already satisfies trivially.
export async function listTopicPassages(topicId: string): Promise<BibleTopicPassage[]> {
  const { data, error } = await supabase
    .from('bible_topic_passages')
    .select('*')
    .eq('topic_id', topicId)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as BibleTopicPassage[]
}
