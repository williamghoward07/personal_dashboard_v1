import { describe, expect, it } from 'vitest'
import type { LinkFolder } from '@/lib/types'
import { groupLauncherLinks, type LauncherLink } from './launcher-groups'

const folder = { id: 'f', name: 'A very long folder name', archived_at: null } as LinkFolder
const link = (id: string, overrides: Partial<LauncherLink> = {}): LauncherLink => ({
  id, title: id, folder_id: null, archived_at: null, ...overrides,
} as LauncherLink)

describe('launcher grouping', () => {
  it('groups selected links at the first folder position and preserves their order', () => {
    const result = groupLauncherLinks([
      link('first'), link('one', { folder_id: 'f', folder }), link('second'), link('two', { folder_id: 'f', folder }),
    ])
    expect(result.map((item) => item.type)).toEqual(['link', 'folder', 'link'])
    expect(result[1]).toMatchObject({ folder, links: [{ id: 'one' }, { id: 'two' }] })
  })
  it('excludes archived links and folders, keeps missing folders accessible, and accepts an empty selection', () => {
    expect(groupLauncherLinks([])).toEqual([])
    expect(groupLauncherLinks([
      link('archived', { archived_at: 'today' }),
      link('hidden', { folder_id: 'f', folder: { ...folder, archived_at: 'today' } }),
      link('orphan', { folder_id: 'missing', folder: null }),
    ])).toMatchObject([{ type: 'link', link: { id: 'orphan' } }])
  })
})
