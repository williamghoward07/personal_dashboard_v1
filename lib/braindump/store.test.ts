import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDraftStore } from './store'
import type { BrainDumpDraft } from './types'

const todoDraft = (title: string): BrainDumpDraft => ({
  kind: 'todo',
  act: { title, due_date: null, due_time: null, notes: null },
  person_match: null,
  person: null,
  interaction: null,
})

function mockFetch(response: { ok: boolean; body: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: response.ok, json: () => Promise.resolve(response.body) })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createDraftStore', () => {
  it('adds extracted drafts as pending, newest first, and clears the text', async () => {
    const store = createDraftStore()
    mockFetch({ ok: true, body: { drafts: [todoDraft('first')] } })
    store.setText('first')
    expect(await store.submit('first')).toBe(true)

    mockFetch({ ok: true, body: { drafts: [todoDraft('second')] } })
    await store.submit('second')

    const { drafts, text, loading } = store.getSnapshot()
    expect(drafts.map((d) => d.act?.title)).toEqual(['second', 'first'])
    expect(drafts.every((d) => d.status === 'pending')).toBe(true)
    expect(new Set(drafts.map((d) => d.clientId)).size).toBe(2)
    expect(text).toBe('')
    expect(loading).toBe(false)
  })

  it('reports an empty extraction as an error', async () => {
    const store = createDraftStore()
    mockFetch({ ok: true, body: { drafts: [] } })
    expect(await store.submit('hello there')).toBe(false)
    expect(store.getSnapshot().error).toMatch(/didn't find anything/i)
  })

  it('surfaces the server error message', async () => {
    const store = createDraftStore()
    mockFetch({ ok: false, body: { error: 'AI daily limit reached' } })
    expect(await store.submit('add milk')).toBe(false)
    expect(store.getSnapshot().error).toBe('AI daily limit reached')
  })

  it('ignores blank input without calling the server', async () => {
    const store = createDraftStore()
    const fetchMock = mockFetch({ ok: true, body: { drafts: [] } })
    expect(await store.submit('   ')).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('edits, resolves and clears drafts', async () => {
    const store = createDraftStore()
    mockFetch({ ok: true, body: { drafts: [todoDraft('a'), todoDraft('b')] } })
    await store.submit('a and b')
    const [a, b] = store.getSnapshot().drafts

    store.updateDraftAct(a.clientId, { title: 'A!', due_date: '2026-09-20' })
    store.setDraftStatus(b.clientId, 'rejected')
    expect(store.getSnapshot().drafts[0].act).toMatchObject({ title: 'A!', due_date: '2026-09-20' })

    store.clearFinished()
    expect(store.getSnapshot().drafts.map((d) => d.clientId)).toEqual([a.clientId])
  })

  it('keeps separate stores separate and notifies subscribers', async () => {
    const one = createDraftStore()
    const two = createDraftStore()
    const listener = vi.fn()
    two.subscribe(listener)
    one.setText('only in one')
    expect(two.getSnapshot().text).toBe('')
    expect(listener).not.toHaveBeenCalled()
    two.setText('x')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
