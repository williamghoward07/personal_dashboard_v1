import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The user_settings calls useSettings makes: select(…).maybeSingle() and upsert(row, opts).
const db = vi.hoisted(() => ({
  read: { data: null as unknown, error: null as { message: string } | null },
  upsertError: null as { message: string } | null,
  upserts: [] as Record<string, unknown>[],
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ maybeSingle: () => Promise.resolve(db.read) }),
      upsert: (row: Record<string, unknown>) => {
        db.upserts.push(row)
        return Promise.resolve({ error: db.upsertError })
      },
    }),
  },
}))

import { useSettings } from './use-settings'

const STORED = {
  home_layout: [{ id: 'calendar', span: 2, hidden: false }],
  hidden_nav_items: ['/money'],
  launcher_link_ids: ['11111111-1111-1111-1111-111111111111'],
  calendar_view: 'day',
  work_filter: { tab: 'pastDue', categories: 'all', modules: 'all' },
  week_one_start: '2026-07-20',
}

beforeEach(() => {
  db.read = { data: null, error: null }
  db.upsertError = null
  db.upserts = []
})

async function mounted() {
  const hook = renderHook(() => useSettings())
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

describe('useSettings.updateSettings', () => {
  it('after a failed read, writes only the patched key, never the defaults', async () => {
    db.read = { data: null, error: { message: 'permission denied' } }
    const { result } = await mounted()
    await act(() => result.current.updateSettings({ calendar_view: 'month' }))
    expect(db.upserts).toEqual([{ calendar_view: 'month', updated_at: expect.any(String) }])
    expect(result.current.settings.calendar_view).toBe('month')
    expect(result.current.error).toBeNull()
  })

  it('after a successful read, shows the stored settings and writes only the patch', async () => {
    db.read = { data: STORED, error: null }
    const { result } = await mounted()
    expect(result.current.settings.week_one_start).toBe('2026-07-20')
    const filter = { tab: 'upcoming' as const, categories: 'all' as const, modules: ['GEOG1081'] }
    await act(() => result.current.updateSettings({ work_filter: filter }))
    expect(db.upserts).toEqual([{ work_filter: filter, updated_at: expect.any(String) }])
    expect(result.current.settings).toMatchObject({
      work_filter: filter,
      calendar_view: 'day',
      week_one_start: '2026-07-20',
      hidden_nav_items: ['/money'],
    })
  })

  it('rolls back and reports a failed write', async () => {
    db.read = { data: STORED, error: null }
    db.upsertError = { message: 'network down' }
    const { result } = await mounted()
    await act(() => result.current.updateSettings({ calendar_view: 'month' }))
    expect(result.current.settings.calendar_view).toBe('day')
    expect(result.current.error).toBe('network down')
  })
})
