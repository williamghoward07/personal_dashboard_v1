import { describe, expect, it } from 'vitest'
import { filterFollows, sortFollows } from './list'
import type { InstagramFollow } from '@/lib/types'

function follow(overrides: Partial<InstagramFollow> & { id: string; handle: string }): InstagramFollow {
  return {
    display_name: null,
    note: null,
    category: null,
    followed_at: '2026-01-01T00:00:00Z',
    person_id: null,
    ...overrides,
  }
}

describe('filterFollows', () => {
  const follows = [
    follow({ id: '1', handle: 'sam_kim', display_name: 'Sam Kim', note: null, category: 'friend', person_id: 'p1' }),
    follow({ id: '2', handle: 'bbcnews', display_name: null, note: 'news account', category: null, person_id: null }),
    follow({ id: '3', handle: 'jo_b', display_name: null, note: null, category: 'uni', person_id: null }),
  ]

  it('matches the search query against handle, display_name, note, and category, case-insensitively', () => {
    expect(filterFollows(follows, { query: 'SAM', status: 'all', category: null }).map((f) => f.id)).toEqual(['1'])
    expect(filterFollows(follows, { query: 'news', status: 'all', category: null }).map((f) => f.id)).toEqual(['2'])
    expect(filterFollows(follows, { query: 'uni', status: 'all', category: null }).map((f) => f.id)).toEqual(['3'])
  })

  it('filters by linked status', () => {
    expect(filterFollows(follows, { query: '', status: 'linked', category: null }).map((f) => f.id)).toEqual(['1'])
    expect(filterFollows(follows, { query: '', status: 'unlinked', category: null }).map((f) => f.id)).toEqual(['2', '3'])
  })

  it('filters by an exact category', () => {
    expect(filterFollows(follows, { query: '', status: 'all', category: 'uni' }).map((f) => f.id)).toEqual(['3'])
  })

  it('filters to uncategorized rows with the empty-string pseudo-category', () => {
    expect(filterFollows(follows, { query: '', status: 'all', category: '' }).map((f) => f.id)).toEqual(['2'])
  })

  it('returns everything when query/category are unset and status is all', () => {
    expect(filterFollows(follows, { query: '', status: 'all', category: null })).toHaveLength(3)
  })
})

describe('sortFollows', () => {
  const follows = [
    follow({ id: '1', handle: 'charlie', followed_at: '2026-01-02T00:00:00Z' }),
    follow({ id: '2', handle: 'alpha', display_name: 'Zeta', followed_at: '2026-01-03T00:00:00Z' }),
    follow({ id: '3', handle: 'bravo', followed_at: '2026-01-01T00:00:00Z' }),
  ]

  it('sorts newest-followed first by default', () => {
    expect(sortFollows(follows, 'followed_desc').map((f) => f.id)).toEqual(['2', '1', '3'])
  })

  it('sorts oldest-followed first', () => {
    expect(sortFollows(follows, 'followed_asc').map((f) => f.id)).toEqual(['3', '1', '2'])
  })

  it('sorts alphabetically by handle', () => {
    expect(sortFollows(follows, 'handle_asc').map((f) => f.id)).toEqual(['2', '3', '1'])
  })

  it('sorts alphabetically by display_name, falling back to handle', () => {
    // '2' has display_name "Zeta" (sorts last); '1' and '3' fall back to their handles.
    expect(sortFollows(follows, 'display_name_asc').map((f) => f.id)).toEqual(['3', '1', '2'])
  })

  it('does not mutate the input array', () => {
    const original = [...follows]
    sortFollows(follows, 'handle_asc')
    expect(follows).toEqual(original)
  })
})
