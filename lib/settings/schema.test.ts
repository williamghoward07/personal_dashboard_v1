import { describe, expect, it } from 'vitest'
import { clampSpan, defaultSettings, mergeHomeLayout, parseHomeLayout, parseUserSettings } from './schema'

describe('clampSpan', () => {
  it('passes valid spans through', () => {
    expect(clampSpan(1)).toBe(1)
    expect(clampSpan(4)).toBe(4)
  })

  it('clamps out-of-range spans', () => {
    expect(clampSpan(0)).toBe(1)
    expect(clampSpan(-5)).toBe(1)
    expect(clampSpan(5)).toBe(4)
    expect(clampSpan(99)).toBe(4)
  })

  it('rounds and defaults to 1 for anything unparseable', () => {
    expect(clampSpan(2.6)).toBe(3)
    expect(clampSpan('3')).toBe(3)
    expect(clampSpan('nonsense')).toBe(1)
    expect(clampSpan(null)).toBe(1)
    expect(clampSpan(undefined)).toBe(1)
  })
})

describe('parseHomeLayout', () => {
  it('returns an empty array for non-array input', () => {
    expect(parseHomeLayout(null)).toEqual([])
    expect(parseHomeLayout(undefined)).toEqual([])
    expect(parseHomeLayout('not an array')).toEqual([])
    expect(parseHomeLayout({})).toEqual([])
  })

  it('drops malformed entries and coerces the rest', () => {
    expect(
      parseHomeLayout([{ id: 'daily-goals', span: 2, hidden: true }, { notAnId: true }, 'string', null, 42])
    ).toEqual([{ id: 'daily-goals', span: 2, hidden: true }])
  })

  it('drops duplicate ids, keeping the first', () => {
    expect(
      parseHomeLayout([
        { id: 'money', span: 1, hidden: false },
        { id: 'money', span: 3, hidden: true },
      ])
    ).toEqual([{ id: 'money', span: 1, hidden: false }])
  })

  it('clamps spans and coerces hidden to boolean', () => {
    expect(parseHomeLayout([{ id: 'money', span: 99, hidden: 'yes' }])).toEqual([
      { id: 'money', span: 4, hidden: true },
    ])
    expect(parseHomeLayout([{ id: 'money' }])).toEqual([{ id: 'money', span: 1, hidden: false }])
  })
})

describe('mergeHomeLayout', () => {
  const knownIds = ['daily-goals', 'education', 'money', 'habits']

  it('appends known widgets missing from stored, in registry order', () => {
    expect(mergeHomeLayout([{ id: 'money', span: 2, hidden: false }], knownIds)).toEqual([
      { id: 'money', span: 2, hidden: false },
      { id: 'daily-goals', span: 1, hidden: false },
      { id: 'education', span: 1, hidden: false },
      { id: 'habits', span: 1, hidden: false },
    ])
  })

  it('drops stored ids that are no longer known widgets', () => {
    expect(
      mergeHomeLayout(
        [
          { id: 'money', span: 2, hidden: false },
          { id: 'removed-widget', span: 1, hidden: false },
        ],
        knownIds
      )
    ).toEqual([
      { id: 'money', span: 2, hidden: false },
      { id: 'daily-goals', span: 1, hidden: false },
      { id: 'education', span: 1, hidden: false },
      { id: 'habits', span: 1, hidden: false },
    ])
  })

  it('clamps spans on stored entries', () => {
    const stored = [{ id: 'money', span: 9, hidden: false }] as unknown as { id: string; span: 1; hidden: boolean }[]
    expect(mergeHomeLayout(stored, knownIds)[0].span).toBe(4)
  })

  it('preserves stored order and hidden flags rather than resorting', () => {
    const stored = [
      { id: 'habits', span: 1 as const, hidden: true },
      { id: 'daily-goals', span: 2 as const, hidden: false },
    ]
    expect(mergeHomeLayout(stored, knownIds)).toEqual([
      { id: 'habits', span: 1, hidden: true },
      { id: 'daily-goals', span: 2, hidden: false },
      { id: 'education', span: 1, hidden: false },
      { id: 'money', span: 1, hidden: false },
    ])
  })

  it('returns every known widget with defaults when nothing is stored', () => {
    expect(mergeHomeLayout([], knownIds)).toEqual(
      knownIds.map((id) => ({ id, span: 1, hidden: false }))
    )
    expect(mergeHomeLayout(null, knownIds)).toEqual(
      knownIds.map((id) => ({ id, span: 1, hidden: false }))
    )
  })

  it('drops duplicate stored ids', () => {
    const stored = [
      { id: 'money', span: 1 as const, hidden: false },
      { id: 'money', span: 3 as const, hidden: true },
    ]
    expect(mergeHomeLayout(stored, knownIds)).toEqual([
      { id: 'money', span: 1, hidden: false },
      { id: 'daily-goals', span: 1, hidden: false },
      { id: 'education', span: 1, hidden: false },
      { id: 'habits', span: 1, hidden: false },
    ])
  })
})

describe('parseUserSettings', () => {
  it('returns defaults for null/undefined (no row yet)', () => {
    expect(parseUserSettings(null)).toEqual(defaultSettings())
    expect(parseUserSettings(undefined)).toEqual(defaultSettings())
  })

  it('parses a well-formed row', () => {
    const row = {
      home_layout: [{ id: 'money', span: 2, hidden: false }],
      hidden_nav_items: ['/todos'],
      launcher_link_ids: ['11111111-1111-1111-1111-111111111111'],
    }
    expect(parseUserSettings(row)).toEqual({
      home_layout: [{ id: 'money', span: 2, hidden: false }],
      hidden_nav_items: ['/todos'],
      launcher_link_ids: ['11111111-1111-1111-1111-111111111111'],
    })
  })

  it('tolerates malformed fields rather than throwing', () => {
    expect(
      parseUserSettings({
        home_layout: 'not an array',
        hidden_nav_items: [1, 2, '/todos'],
        launcher_link_ids: null,
      })
    ).toEqual({
      home_layout: [],
      hidden_nav_items: ['/todos'],
      launcher_link_ids: [],
    })
  })
})
