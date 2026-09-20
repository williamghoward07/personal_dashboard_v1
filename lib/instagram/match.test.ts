import { describe, expect, it } from 'vitest'
import { describeMatchBatch, normalizeForMatch, similarityScore, suggestMatch } from './match'
import type { InstagramFollow, Person } from '@/lib/types'

function person(overrides: Partial<Person> & { id: string; full_name: string }): Person {
  return {
    email: null,
    phone: null,
    company: null,
    job_title: null,
    linkedin_url: null,
    photo_url: null,
    how_we_met: null,
    birthday: null,
    notes: null,
    tags: [],
    google_resource_name: null,
    google_etag: null,
    google_synced_at: null,
    archived: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function follow(overrides: Partial<InstagramFollow> & { handle: string }): InstagramFollow {
  return {
    id: 'f1',
    display_name: null,
    note: null,
    category: null,
    followed_at: '2026-01-01T00:00:00Z',
    person_id: null,
    ...overrides,
  }
}

describe('normalizeForMatch', () => {
  it('lowercases, strips diacritics, and turns separators into spaces', () => {
    expect(normalizeForMatch('Jess_Dudley_')).toBe('jess dudley')
    expect(normalizeForMatch('Émile-Dùpont')).toBe('emile dupont')
  })
})

describe('similarityScore', () => {
  it('scores an exact name match at 1', () => {
    expect(similarityScore('Sam Kim', 'Sam Kim')).toBe(1)
  })

  it('scores dotted/underscored handles against a full name highly via token overlap', () => {
    expect(similarityScore('jess_dudley_', 'Jess Dudley')).toBeGreaterThan(0.9)
  })

  it('scores a separator-free handle against a multi-word name via the concatenated ratio', () => {
    expect(similarityScore('durhamcollegerunning', 'Durham College Running')).toBeGreaterThan(0.9)
  })

  it('tolerates a small typo', () => {
    expect(similarityScore('sam.kimm', 'Sam Kim')).toBeGreaterThan(0.7)
  })

  it('scores unrelated strings low', () => {
    expect(similarityScore('bbcnews', 'Sam Kim')).toBeLessThan(0.4)
  })
})

describe('suggestMatch', () => {
  const people = [
    person({ id: 'p1', full_name: 'Jess Dudley' }),
    person({ id: 'p2', full_name: 'Sam Kim' }),
    person({ id: 'p3', full_name: 'Archived Person', archived: true }),
  ]

  it('returns the best match above the threshold', () => {
    const result = suggestMatch(follow({ handle: 'jess_dudley_' }), people)
    expect(result?.person.id).toBe('p1')
    expect(result?.score).toBeGreaterThan(0.72)
  })

  it('prefers display_name over handle when it scores higher', () => {
    const result = suggestMatch(follow({ handle: 'xyz123', display_name: 'Sam Kim' }), people)
    expect(result?.person.id).toBe('p2')
  })

  it('returns null when nothing clears the threshold', () => {
    expect(suggestMatch(follow({ handle: 'bbcnews' }), people)).toBeNull()
  })

  it('ignores archived people', () => {
    expect(suggestMatch(follow({ handle: 'archived_person' }), people)).toBeNull()
  })

  it('returns null for an empty people list', () => {
    expect(suggestMatch(follow({ handle: 'jess_dudley_' }), [])).toBeNull()
  })

  it('handles a missing display_name without throwing', () => {
    expect(() => suggestMatch(follow({ handle: 'jess_dudley_', display_name: null }), people)).not.toThrow()
  })
})

describe('describeMatchBatch', () => {
  const people = [person({ id: 'p1', full_name: 'Jess Dudley' })]

  it('formats one line per match', () => {
    const matches = [{ follow: follow({ handle: 'jess_dudley_' }), person: people[0], score: 0.92 }]
    expect(describeMatchBatch(matches)).toBe('@jess_dudley_ → Jess Dudley (92% match)')
  })

  it('caps at maxLines and appends a remainder count', () => {
    const matches = Array.from({ length: 20 }, (_, i) => ({
      follow: follow({ id: `f${i}`, handle: `handle${i}` }),
      person: people[0],
      score: 0.8,
    }))
    const result = describeMatchBatch(matches, 15)
    const lines = result.split('\n')
    expect(lines).toHaveLength(16)
    expect(lines[15]).toBe('…and 5 more')
  })

  it('returns an empty string for no matches', () => {
    expect(describeMatchBatch([])).toBe('')
  })
})
