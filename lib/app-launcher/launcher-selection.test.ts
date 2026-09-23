import { describe, expect, it } from 'vitest'
import {
  reorderLauncherIds,
  resolveLauncherIds,
  seedLauncherIds,
  tilesForSpan,
  toggleLauncherLink,
  type SeedableLink,
} from './launcher-selection'

describe('resolveLauncherIds', () => {
  it('drops stale ids not present in the available set', () => {
    expect(resolveLauncherIds(['a', 'gone', 'b'], ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('drops duplicates while preserving order', () => {
    expect(resolveLauncherIds(['a', 'b', 'a'], ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('preserves the stored order, not the available order', () => {
    expect(resolveLauncherIds(['b', 'a'], ['a', 'b'])).toEqual(['b', 'a'])
  })

  it('accepts a Set directly', () => {
    expect(resolveLauncherIds(['a', 'x'], new Set(['a']))).toEqual(['a'])
  })

  it('returns an empty array when nothing resolves', () => {
    expect(resolveLauncherIds([], ['a', 'b'])).toEqual([])
    expect(resolveLauncherIds(['gone'], ['a'])).toEqual([])
  })
})

describe('seedLauncherIds', () => {
  const link = (id: string, is_pinned: boolean, sort_order: number): SeedableLink => ({ id, is_pinned, sort_order })

  it('seeds from pinned links ordered by sort_order', () => {
    const links = [link('c', true, 2), link('a', true, 0), link('b', false, 1)]
    expect(seedLauncherIds(links)).toEqual(['a', 'c'])
  })

  it('returns empty when nothing is pinned', () => {
    expect(seedLauncherIds([link('a', false, 0)])).toEqual([])
  })

  it('returns empty for no links', () => {
    expect(seedLauncherIds([])).toEqual([])
  })
})

describe('toggleLauncherLink', () => {
  it('adds an id not already present, appended at the end', () => {
    expect(toggleLauncherLink(['a', 'b'], 'c')).toEqual(['a', 'b', 'c'])
  })

  it('removes an id already present', () => {
    expect(toggleLauncherLink(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })
})

describe('reorderLauncherIds', () => {
  it('moves an id forward to sit where the target is', () => {
    expect(reorderLauncherIds(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an id backward to sit where the target is', () => {
    expect(reorderLauncherIds(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c'])
  })

  it('is a no-op when active and over are the same id', () => {
    expect(reorderLauncherIds(['a', 'b'], 'a', 'a')).toEqual(['a', 'b'])
  })

  it('returns the ids unchanged for an unknown active id', () => {
    expect(reorderLauncherIds(['a', 'b'], 'nope', 'a')).toEqual(['a', 'b'])
  })

  it('returns the ids unchanged for an unknown over id', () => {
    expect(reorderLauncherIds(['a', 'b'], 'a', 'nope')).toEqual(['a', 'b'])
  })
})

describe('tilesForSpan', () => {
  it('matches the old MAX_TILES = 7 at span 1', () => {
    expect(tilesForSpan(1)).toBe(7)
  })

  it('grows with span', () => {
    expect(tilesForSpan(2)).toBe(15)
    expect(tilesForSpan(3)).toBe(23)
    expect(tilesForSpan(4)).toBe(31)
  })
})
