import { describe, expect, it } from 'vitest'
import type { WorkspaceFolder } from '@/lib/types'
import {
  childFolders,
  descendantIds,
  folderCounts,
  folderPath,
  moveTargets,
  resolveAccent,
  resolveFolderAccent,
} from './folders'

const folder = (id: string, parent_id: string | null, color: string | null = null, sort_order = 0): WorkspaceFolder => ({
  id,
  name: id.toUpperCase(),
  color,
  parent_id,
  sort_order,
  created_at: '2026-09-01T00:00:00Z',
})

// uni (orange) > year2 (no colour) > essays (no colour);  side (pink)
const folders = [
  folder('uni', null, 'orange', 0),
  folder('year2', 'uni', null, 0),
  folder('essays', 'year2', null, 0),
  folder('side', null, 'pink', 1),
]

describe('folderPath', () => {
  it('returns the chain root-first', () => {
    expect(folderPath(folders, 'essays').map((f) => f.id)).toEqual(['uni', 'year2', 'essays'])
  })

  it('is empty for the top level or an unknown id', () => {
    expect(folderPath(folders, null)).toEqual([])
    expect(folderPath(folders, 'nope')).toEqual([])
  })

  it('stops on a cycle instead of looping', () => {
    const cyclic = [folder('a', 'b'), folder('b', 'a')]
    expect(folderPath(cyclic, 'a').map((f) => f.id)).toEqual(['b', 'a'])
  })
})

describe('descendantIds', () => {
  it('includes the folder itself and everything beneath it', () => {
    expect([...descendantIds(folders, 'uni')].sort()).toEqual(['essays', 'uni', 'year2'])
    expect([...descendantIds(folders, 'side')]).toEqual(['side'])
  })
})

describe('childFolders', () => {
  it('lists direct children in sort order', () => {
    expect(childFolders(folders, null).map((f) => f.id)).toEqual(['uni', 'side'])
    expect(childFolders(folders, 'uni').map((f) => f.id)).toEqual(['year2'])
  })
})

describe('folderCounts', () => {
  it('counts active workspaces anywhere beneath, and direct subfolders', () => {
    const workspaces = [
      { folder_id: 'essays', archived_at: null },
      { folder_id: 'uni', archived_at: null },
      { folder_id: 'uni', archived_at: '2026-09-01' },
      { folder_id: 'side', archived_at: null },
      { folder_id: null, archived_at: null },
    ]
    expect(folderCounts(folders, workspaces, 'uni')).toEqual({ workspaces: 2, subfolders: 1 })
  })
})

describe('resolveAccent', () => {
  it("prefers the workspace's own colour", () => {
    expect(resolveAccent({ color: 'blue', folder_id: 'essays' }, folders)).toBe('blue')
  })

  it('inherits from the nearest coloured ancestor folder', () => {
    expect(resolveAccent({ color: null, folder_id: 'essays' }, folders)).toBe('orange')
    expect(resolveFolderAccent(folders, 'year2')).toBe('orange')
  })

  it('falls back to teal at the top level or for an unknown colour', () => {
    expect(resolveAccent({ color: null, folder_id: null }, folders)).toBe('teal')
    expect(resolveAccent({ color: 'rainbow', folder_id: null }, folders)).toBe('teal')
  })
})

describe('moveTargets', () => {
  it('lists the top level then every folder, indented', () => {
    expect(moveTargets(folders).map((t) => [t.id, t.depth])).toEqual([
      [null, 0],
      ['uni', 1],
      ['year2', 2],
      ['essays', 3],
      ['side', 1],
    ])
  })

  it("excludes a moving folder and its subfolders", () => {
    expect(moveTargets(folders, 'year2').map((t) => t.id)).toEqual([null, 'uni', 'side'])
  })
})
