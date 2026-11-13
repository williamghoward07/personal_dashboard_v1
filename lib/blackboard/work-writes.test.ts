import { beforeEach, describe, expect, it, vi } from 'vitest'

// A minimal stand-in for the bb_key_dates calls editKeyDate makes:
// select('due_at').eq('id', …).maybeSingle() and update(patch).eq('id', …).
const db = vi.hoisted(() => ({
  stored: null as { due_at: string | null } | null,
  selects: 0,
  updates: [] as Record<string, unknown>[],
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => {
        db.selects++
        return { eq: () => ({ maybeSingle: async () => ({ data: db.stored, error: null }) }) }
      },
      update: (patch: Record<string, unknown>) => {
        db.updates.push(patch)
        return { eq: async () => ({ error: null }) }
      },
    }),
  },
}))

import { editKeyDate } from './work-writes'

beforeEach(() => {
  db.stored = null
  db.selects = 0
  db.updates = []
})

describe('editKeyDate', () => {
  it('moves a stored time onto the new day when only the date changes', async () => {
    db.stored = { due_at: '2026-11-11T14:00:00Z' }
    expect(await editKeyDate('kd', { due_on: '2026-11-26' })).toEqual({ error: null })
    expect(db.updates).toHaveLength(1)
    expect(db.updates[0]).toMatchObject({ due_on: '2026-11-26', due_at: '2026-11-26T14:00:00.000Z', status: 'confirmed' })
  })

  it('keeps the London wall time across the clock change', async () => {
    db.stored = { due_at: '2026-10-20T13:00:00Z' } // 14:00 BST
    await editKeyDate('kd', { due_on: '2026-11-03' })
    expect(db.updates[0].due_at).toBe('2026-11-03T14:00:00.000Z') // 14:00 GMT
  })

  it('a date with no time stays without one', async () => {
    db.stored = { due_at: null }
    await editKeyDate('kd', { due_on: '2026-11-26' })
    expect(db.updates[0]).toHaveProperty('due_at', null)
  })

  it('an explicit due_at wins and skips the read', async () => {
    await editKeyDate('kd', { due_on: '2026-11-26', due_at: null })
    expect(db.selects).toBe(0)
    expect(db.updates[0]).toHaveProperty('due_at', null)
    await editKeyDate('kd', { due_on: '2026-11-26', due_at: '2026-11-26T09:00:00Z' })
    expect(db.updates[1].due_at).toBe('2026-11-26T09:00:00Z')
  })

  it('reports a missing row and writes nothing', async () => {
    db.stored = null
    expect(await editKeyDate('kd', { due_on: '2026-11-26' })).toEqual({ error: 'Key date not found' })
    expect(db.updates).toEqual([])
  })

  it('validates before touching the database', async () => {
    expect(await editKeyDate('kd', { due_on: '2026-02-30' })).toEqual({ error: 'Not a valid date' })
    expect(db.selects + db.updates.length).toBe(0)
  })
})
