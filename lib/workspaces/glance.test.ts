import { describe, expect, it } from 'vitest'
import { rankWorkspacesForGlance } from './glance'

const ws = (id: string, created_at: string, archived_at: string | null = null) => ({ id, created_at, archived_at })

describe('rankWorkspacesForGlance', () => {
  const workspaces = [
    ws('essay', '2026-09-01T00:00:00Z'),
    ws('brand', '2026-09-10T00:00:00Z'),
    ws('old', '2026-08-01T00:00:00Z', '2026-08-20T00:00:00Z'),
    ws('fresh', '2026-09-15T00:00:00Z'),
  ]
  const sessions = [
    { workspace_id: 'essay', started_at: '2026-09-16T09:00:00Z' },
    { workspace_id: 'essay', started_at: '2026-09-12T09:00:00Z' },
    { workspace_id: 'brand', started_at: '2026-09-11T09:00:00Z' },
    { workspace_id: 'old', started_at: '2026-09-16T10:00:00Z' },
  ]

  it('orders active workspaces by last opened, falling back to creation time', () => {
    const rows = rankWorkspacesForGlance(workspaces, sessions, [], 10)
    expect(rows.map((r) => r.workspace.id)).toEqual(['essay', 'fresh', 'brand'])
    expect(rows[0].lastOpenedAt).toBe('2026-09-16T09:00:00Z')
    expect(rows[1].lastOpenedAt).toBeNull()
  })

  it('counts open actions per workspace', () => {
    const rows = rankWorkspacesForGlance(workspaces, sessions, ['essay', 'essay', null, 'brand'], 10)
    expect(Object.fromEntries(rows.map((r) => [r.workspace.id, r.openActions]))).toEqual({
      essay: 2,
      fresh: 0,
      brand: 1,
    })
  })

  it('applies the limit', () => {
    expect(rankWorkspacesForGlance(workspaces, sessions, [], 2)).toHaveLength(2)
  })
})
