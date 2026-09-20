import { describe, expect, it } from 'vitest'
import { buildFollowsCsv, followsExportFilename, type FollowExportRow } from './export'

function row(overrides: Partial<FollowExportRow> & { handle: string }): FollowExportRow {
  return {
    display_name: null,
    followed_at: '2026-01-15T12:30:00.000Z',
    category: null,
    note: null,
    person_full_name: null,
    ...overrides,
  }
}

describe('buildFollowsCsv', () => {
  it('writes the header row and no data rows for an empty array', () => {
    expect(buildFollowsCsv([])).toBe('handle,display_name,followed_at,category,note,linked_person')
  })

  it('writes one line per row with expected columns and date-only formatting', () => {
    const csv = buildFollowsCsv([
      row({ handle: 'sam_kim', display_name: 'Sam Kim', category: 'friend', note: 'met at uni', person_full_name: 'Sam Kim' }),
    ])
    const lines = csv.split('\n')
    expect(lines[0]).toBe('handle,display_name,followed_at,category,note,linked_person')
    expect(lines[1]).toBe('sam_kim,Sam Kim,2026-01-15,friend,met at uni,Sam Kim')
  })

  it('leaves missing optional fields blank', () => {
    const csv = buildFollowsCsv([row({ handle: 'bbcnews' })])
    expect(csv.split('\n')[1]).toBe('bbcnews,,2026-01-15,,,')
  })

  it('quotes fields containing commas, quotes, or newlines per RFC4180', () => {
    const csv = buildFollowsCsv([row({ handle: 'sam_kim', note: 'met at uni, said "hi"\nfollow up soon' })])
    expect(csv.split('\n').slice(1).join('\n')).toContain('"met at uni, said ""hi""\nfollow up soon"')
  })
})

describe('followsExportFilename', () => {
  it('builds a dated csv filename', () => {
    expect(followsExportFilename('csv')).toMatch(/^instagram-follows-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})
