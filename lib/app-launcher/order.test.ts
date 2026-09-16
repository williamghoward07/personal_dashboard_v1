import { describe, expect, it } from 'vitest'
import {
  applyPatches,
  displayOrder,
  folderOrderPatches,
  groupLinks,
  linkOrderPatches,
  moveLink,
  type OrderableLink,
} from './order'

const link = (id: string, folder_id: string | null, sort_order: number): OrderableLink => ({ id, folder_id, sort_order })

const ids = (links: OrderableLink[]) => links.map((l) => l.id)

describe('groupLinks / displayOrder', () => {
  const links = [link('u1', null, 0), link('a1', 'A', 1), link('b1', 'B', 2), link('a2', 'A', 3)]

  it('groups by folder, keeping order', () => {
    const groups = groupLinks(links)
    expect(ids(groups.get('A')!)).toEqual(['a1', 'a2'])
    expect(ids(groups.get('unfiled')!)).toEqual(['u1'])
  })

  it('flattens folder by folder with Unfiled last', () => {
    expect(ids(displayOrder(links, ['B', 'A']))).toEqual(['b1', 'a1', 'a2', 'u1'])
  })

  it('never drops links in an unknown folder', () => {
    expect(ids(displayOrder([link('x', 'gone', 0)], ['A']))).toEqual(['x'])
  })
})

describe('moveLink', () => {
  const links = [link('a1', 'A', 0), link('a2', 'A', 1), link('a3', 'A', 2), link('b1', 'B', 3)]

  it('moves down within a folder like arrayMove (lands after the target)', () => {
    expect(ids(moveLink(links, 'a1', 'A', 'a3'))).toEqual(['a2', 'a3', 'a1', 'b1'])
  })

  it('moves up within a folder (lands before the target)', () => {
    expect(ids(moveLink(links, 'a3', 'A', 'a1'))).toEqual(['a3', 'a1', 'a2', 'b1'])
  })

  it('moves into another folder before the hovered link', () => {
    const moved = moveLink(links, 'a2', 'B', 'b1')
    expect(ids(moved)).toEqual(['a1', 'a3', 'a2', 'b1'])
    expect(moved.find((l) => l.id === 'a2')!.folder_id).toBe('B')
  })

  it('appends to the end of a folder when dropped on the folder itself', () => {
    const moved = moveLink(links, 'a1', 'B', null)
    expect(ids(moved)).toEqual(['a2', 'a3', 'b1', 'a1'])
    expect(moved.find((l) => l.id === 'a1')!.folder_id).toBe('B')
  })

  it('appends to an empty folder (or Unfiled) at the end', () => {
    const moved = moveLink(links, 'a1', null, null)
    expect(ids(moved)).toEqual(['a2', 'a3', 'b1', 'a1'])
    expect(moved.find((l) => l.id === 'a1')!.folder_id).toBeNull()
  })

  it('returns the input unchanged for an unknown id', () => {
    expect(moveLink(links, 'nope', 'A', null)).toBe(links)
  })
})

describe('linkOrderPatches', () => {
  it('renumbers globally and only patches what changed', () => {
    const previous = [link('a1', 'A', 0), link('a2', 'A', 1), link('b1', 'B', 2)]
    const ordered = [link('a2', 'A', 1), link('a1', 'A', 0), link('b1', 'B', 2)]
    expect(linkOrderPatches(ordered, previous)).toEqual([
      { id: 'a2', patch: { sort_order: 0 } },
      { id: 'a1', patch: { sort_order: 1 } },
    ])
  })

  it('includes a folder change', () => {
    const previous = [link('a1', 'A', 0), link('b1', 'B', 1)]
    const ordered = [link('b1', 'B', 1), link('a1', 'B', 0)]
    expect(linkOrderPatches(ordered, previous)).toEqual([
      { id: 'b1', patch: { sort_order: 0 } },
      { id: 'a1', patch: { sort_order: 1, folder_id: 'B' } },
    ])
  })

  it('handles ties in the stored order', () => {
    const previous = [link('a1', 'A', 0), link('b1', 'B', 0)]
    expect(linkOrderPatches(previous, previous)).toEqual([{ id: 'b1', patch: { sort_order: 1 } }])
  })
})

describe('folderOrderPatches / applyPatches', () => {
  it('patches folders whose position changed', () => {
    const ordered = [
      { id: 'B', sort_order: 1 },
      { id: 'A', sort_order: 0 },
      { id: 'C', sort_order: 2 },
    ]
    expect(folderOrderPatches(ordered)).toEqual([
      { id: 'B', patch: { sort_order: 0 } },
      { id: 'A', patch: { sort_order: 1 } },
    ])
  })

  it('applies patches to local rows', () => {
    const rows = [link('a1', 'A', 5)]
    expect(applyPatches(rows, [{ id: 'a1', patch: { sort_order: 0, folder_id: null } }])).toEqual([
      link('a1', null, 0),
    ])
  })
})
