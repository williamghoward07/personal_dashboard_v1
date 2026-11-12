import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

function mockResponses(bodies: { status?: number; body: unknown }[]) {
  const fetchMock = vi.fn()
  for (const b of bodies) fetchMock.mockResolvedValueOnce({ ok: (b.status ?? 200) < 400, status: b.status ?? 200, json: async () => b.body })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function load() {
  vi.resetModules()
  const events = await import('./events')
  const spy = vi.spyOn(events, 'notifyWorkChanged')
  const mod = await import('./use-bb-processing')
  return { useBbProcessing: mod.useBbProcessing, spy }
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useBbProcessing', () => {
  it('loops until nothing is left, summing totals and announcing changes', async () => {
    const fetchMock = mockResponses([
      { body: { processed: 40, skippedUnchanged: 0, added: 0, remaining: 2, budgetHit: false } },
      { body: { processed: 6, skippedUnchanged: 40, added: 2, remaining: 1, budgetHit: false } },
      { body: { processed: 1, skippedUnchanged: 46, added: 0, remaining: 0, budgetHit: false } },
    ])
    const { useBbProcessing, spy } = await load()
    const { result, rerender } = renderHook(() => useBbProcessing({ auto: true }))
    rerender() // a second render (or mount) never starts a second loop
    await waitFor(() => expect(result.current.state).toBe('done'), { timeout: 3000 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenCalledWith('/api/work/process', { method: 'POST' })
    expect(result.current.totals).toEqual({ processed: 47, unchanged: 46, added: 2 })
    expect(result.current.remaining).toBe(0)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('bb-processing-lock')).toBeNull()
  })

  it('stops on the budget, on disabled and on errors', async () => {
    mockResponses([{ body: { processed: 0, remaining: 5, budgetHit: true } }])
    let hook = await load()
    let r = renderHook(() => hook.useBbProcessing({ auto: true }))
    await waitFor(() => expect(r.result.current.state).toBe('budget'))

    mockResponses([{ body: { disabled: true, remaining: 0 } }])
    hook = await load()
    r = renderHook(() => hook.useBbProcessing({ auto: true }))
    await waitFor(() => expect(r.result.current.state).toBe('disabled'))

    mockResponses([{ status: 401, body: { error: 'unauthenticated' } }])
    hook = await load()
    r = renderHook(() => hook.useBbProcessing({ auto: true }))
    await waitFor(() => expect(r.result.current.state).toBe('error'))
    expect(r.result.current.error).toBe('Not signed in')

    mockResponses([{ body: { processed: 0, remaining: 3, budgetHit: false, error: 'model exploded' } }])
    hook = await load()
    r = renderHook(() => hook.useBbProcessing({ auto: true }))
    await waitFor(() => expect(r.result.current.state).toBe('error'))
    expect(r.result.current.error).toBe('model exploded')
  })

  it("doesn't start while another tab holds a fresh lock, and only runs on demand without auto", async () => {
    window.localStorage.setItem('bb-processing-lock', JSON.stringify({ tab: 'other', at: Date.now() }))
    const fetchMock = mockResponses([{ body: { remaining: 0 } }])
    let hook = await load()
    renderHook(() => hook.useBbProcessing({ auto: true }))
    await new Promise((r) => setTimeout(r, 50))
    expect(fetchMock).not.toHaveBeenCalled()

    window.localStorage.clear()
    hook = await load()
    const r = renderHook(() => hook.useBbProcessing({ auto: false }))
    await new Promise((res) => setTimeout(res, 50))
    expect(fetchMock).not.toHaveBeenCalled()
    r.result.current.run()
    await waitFor(() => expect(r.result.current.state).toBe('done'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
