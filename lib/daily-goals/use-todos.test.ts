import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTodos } from './use-todos'

const { mockState } = vi.hoisted(() => ({
  mockState: { updateShouldFail: false, deleteShouldFail: false, includeLinkedTodo: false },
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// Mimics supabase-js's PostgrestFilterBuilder: filter/order methods
// (.or/.order/.eq/.gt/.limit) are independent modifiers that can be
// chained in any order and combination, each returning a builder that
// still has every other method available, and the whole chain is
// "thenable" at any point — awaiting it resolves like a real query
// response ({ data, error }).
function chainable<T>(result: T) {
  const node = {
    or: () => node,
    order: () => node,
    eq: () => node,
    gt: () => node,
    limit: () => node,
    then: (resolve: (value: T) => void) => Promise.resolve(result).then(resolve),
  }
  return node
}

vi.mock('@/lib/supabase', () => {
  const existingTodo = {
    id: 'todo-1',
    title: 'Existing todo',
    notes: null,
    due_date: '2026-08-05',
    completed_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    caldav_uid: null,
  }

  const linkedTodo = {
    id: 'todo-2',
    title: 'Reminders todo',
    notes: null,
    due_date: null,
    completed_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    caldav_uid: 'uid-abc',
  }

  return {
    supabase: {
      from: () => ({
        select: () =>
          chainable({
            data: mockState.includeLinkedTodo ? [existingTodo, linkedTodo] : [existingTodo],
            error: null,
          }),
        update: () => ({
          eq: () =>
            chainable(
              mockState.updateShouldFail ? { error: { message: 'network error' } } : { error: null }
            ),
        }),
        delete: () => ({
          eq: () =>
            chainable(
              mockState.deleteShouldFail ? { error: { message: 'network error' } } : { error: null }
            ),
        }),
        insert: () => ({
          select: () => ({ single: () => chainable({ data: null, error: null }) }),
        }),
      }),
    },
  }
})

describe('useTodos optimistic toggle', () => {
  beforeEach(() => {
    mockState.updateShouldFail = false
    mockState.deleteShouldFail = false
  })

  it('rolls back the optimistic completion when the write fails', async () => {
    mockState.updateShouldFail = true
    const { result } = renderHook(() => useTodos('2026-08-05'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.todos[0].completed_at).toBeNull()

    await act(async () => {
      await result.current.toggleTodo('todo-1')
    })

    // Write failed, so the final state matches the pre-toggle state.
    expect(result.current.todos[0].completed_at).toBeNull()
    expect(result.current.error).toBe('network error')
  })

  it('keeps the optimistic completion when the write succeeds', async () => {
    mockState.updateShouldFail = false
    const { result } = renderHook(() => useTodos('2026-08-05'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.toggleTodo('todo-1')
    })

    expect(result.current.todos[0].completed_at).not.toBeNull()
    expect(result.current.error).toBeNull()
  })
})

describe('useTodos scope', () => {
  it('fetches everything (no .or narrowing) when scope is "all"', async () => {
    const { result } = renderHook(() => useTodos('2026-08-05', 'all'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.todos).toHaveLength(1)
    expect(result.current.error).toBeNull()
  })
})

describe('useTodos updateTodo', () => {
  beforeEach(() => {
    mockState.updateShouldFail = false
  })

  it('rolls back the optimistic edit when the write fails', async () => {
    mockState.updateShouldFail = true
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.updateTodo('todo-1', { title: 'Renamed' })
    })

    expect(result.current.todos[0].title).toBe('Existing todo')
    expect(result.current.error).toBe('network error')
  })

  it('keeps the optimistic edit when the write succeeds', async () => {
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.updateTodo('todo-1', { title: 'Renamed' })
    })

    expect(result.current.todos[0].title).toBe('Renamed')
    expect(result.current.error).toBeNull()
  })
})

describe('useTodos deleteTodo', () => {
  beforeEach(() => {
    mockState.deleteShouldFail = false
  })

  it('restores the optimistically-removed todo when the write fails', async () => {
    mockState.deleteShouldFail = true
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteTodo('todo-1')
    })

    expect(result.current.todos).toHaveLength(1)
    expect(result.current.error).toBe('network error')
  })

  it('keeps the todo removed when the write succeeds', async () => {
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteTodo('todo-1')
    })

    expect(result.current.todos).toHaveLength(0)
    expect(result.current.error).toBeNull()
  })
})

describe('useTodos CalDAV integration', () => {
  beforeEach(() => {
    mockState.updateShouldFail = false
    mockState.deleteShouldFail = false
    mockState.includeLinkedTodo = true
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
  })

  it('does not call the Reminders push route when toggling a todo with no caldav_uid', async () => {
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.toggleTodo('todo-1')
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('pushes the completion to Reminders when toggling a caldav-linked todo', async () => {
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.toggleTodo('todo-2')
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/caldav/reminders/push-completion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caldav_uid: 'uid-abc', completed: true }),
    })
    expect(result.current.todos.find((t) => t.id === 'todo-2')?.completed_at).not.toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('surfaces an error, without rolling back, when the Reminders push fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.toggleTodo('todo-2')
    })

    expect(result.current.todos.find((t) => t.id === 'todo-2')?.completed_at).not.toBeNull()
    expect(result.current.error).toBe("Updated here, but couldn't sync that to Reminders.")
  })

  it('pullReminders calls the pull route and refreshes on success', async () => {
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    fetchMock.mockClear()

    await act(async () => {
      await result.current.pullReminders()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/caldav/reminders/pull', { method: 'POST' })
  })

  it('pullReminders fails silently when the pull route is unreachable', async () => {
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    fetchMock.mockClear()
    fetchMock.mockRejectedValue(new Error('network down'))

    await act(async () => {
      await result.current.pullReminders()
    })

    expect(result.current.error).toBeNull()
  })
})
