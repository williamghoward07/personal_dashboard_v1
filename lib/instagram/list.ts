import type { InstagramFollow } from '@/lib/types'

export type FollowStatusFilter = 'all' | 'linked' | 'unlinked'

/** Sort/filter over an already-loaded array — 482+ rows is cheap client-side. */
export type FollowSort = 'followed_desc' | 'followed_asc' | 'handle_asc' | 'display_name_asc'

export interface FollowFilterOptions {
  query: string
  status: FollowStatusFilter
  /** null = any category, '' = uncategorized (category is null), otherwise an exact category match. */
  category: string | null
}

export function filterFollows(follows: InstagramFollow[], opts: FollowFilterOptions): InstagramFollow[] {
  const query = opts.query.trim().toLowerCase()
  return follows.filter((f) => {
    if (opts.status === 'linked' && !f.person_id) return false
    if (opts.status === 'unlinked' && f.person_id) return false
    if (opts.category === '') {
      if (f.category) return false
    } else if (opts.category !== null) {
      if (f.category !== opts.category) return false
    }
    if (!query) return true
    return [f.handle, f.display_name, f.note, f.category].filter(Boolean).some((field) => field!.toLowerCase().includes(query))
  })
}

export function sortFollows(follows: InstagramFollow[], sort: FollowSort): InstagramFollow[] {
  const copy = [...follows]
  switch (sort) {
    case 'followed_desc':
      return copy.sort((a, b) => b.followed_at.localeCompare(a.followed_at))
    case 'followed_asc':
      return copy.sort((a, b) => a.followed_at.localeCompare(b.followed_at))
    case 'handle_asc':
      return copy.sort((a, b) => a.handle.localeCompare(b.handle))
    case 'display_name_asc':
      return copy.sort((a, b) => (a.display_name ?? a.handle).localeCompare(b.display_name ?? b.handle))
  }
}
