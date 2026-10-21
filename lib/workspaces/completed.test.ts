import { describe, expect, it } from 'vitest'
import type { WorkspaceLink } from '@/lib/types'
import { partitionLinks } from './completed'

function link(id: string, completed_at: string | null = null): WorkspaceLink {
  return {
    id,
    workspace_id: 'ws-1',
    title: id,
    url: `https://example.com/${id}`,
    favicon_path: null,
    position: 0,
    kind: 'other',
    citation: null,
    doi: null,
    meta_label: null,
    completed_at,
    week: null,
    created_at: '2026-08-01T00:00:00.000Z',
  }
}

const DONE = '2026-09-01T00:00:00.000Z'

describe('partitionLinks', () => {
  it('splits open and completed sources, keeping order', () => {
    const { open, completed } = partitionLinks([link('a'), link('b', DONE), link('c'), link('d', DONE)], new Set())
    expect(open.map((l) => l.id)).toEqual(['a', 'c'])
    expect(completed.map((l) => l.id)).toEqual(['b', 'd'])
  })

  it('keeps a just-ticked source in the open list until its grace period ends', () => {
    const links = [link('a'), link('b', DONE)]
    expect(partitionLinks(links, new Set(['b'])).open.map((l) => l.id)).toEqual(['a', 'b'])
    expect(partitionLinks(links, new Set()).completed.map((l) => l.id)).toEqual(['b'])
  })

  it('treats a missing completed_at (column not migrated yet) as open', () => {
    const legacy = { ...link('a'), completed_at: undefined } as unknown as WorkspaceLink
    expect(partitionLinks([legacy], new Set()).open).toHaveLength(1)
  })

  it('returns everything to open once un-completed', () => {
    expect(partitionLinks([link('a', null)], new Set()).completed).toEqual([])
  })
})
