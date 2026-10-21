import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTodos } from './use-todos'

const { mockState } = vi.hoisted(() => ({
  mockState: { updateShouldFail: false, deleteShouldFail: false, includeLinkedTodo: false },
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// Every todo change now goes to the push route; by default it succeeds.
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
})

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
    mstodo_task_id: null,
    mstodo_list_id: null,
    mstodo_checklist_item_id: null,
    starred: false,
  }

  const linkedTodo = {
    id: 'todo-2',
    title: 'To Do task',
    notes: null,
    due_date: null,
    completed_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    caldav_uid: null,
    mstodo_task_id: 'task-abc',
    mstodo_list_id: 'list-1',
    starred: false,
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


describe('useTodos Microsoft To Do sync', () => {
  beforeEach(() => {
    mockState.updateShouldFail = false
    mockState.deleteShouldFail = false
    mockState.includeLinkedTodo = true
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
  })

  const pushBody = (call: unknown[]) => JSON.parse((call[1] as { body: string }).body)

  it('pushes changes to a not-yet-linked todo too (the server creates its task)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, ids: { mstodo_task_id: 'new-task', mstodo_list_id: 'l', mstodo_checklist_item_id: null } }),
    })
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.toggleStar('todo-1')
    })

    expect(pushBody(fetchMock.mock.calls[0])).toEqual({ todo_id: 'todo-1', action: 'update', changes: { starred: true } })
    const todo = result.current.todos.find((t) => t.id === 'todo-1')
    expect(todo?.starred).toBe(true)
    expect(todo?.mstodo_task_id).toBe('new-task')
  })

  it('stays quiet when Microsoft is not connected', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ state: 'not_connected', error: 'x' }) })
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.toggleTodo('todo-1')
    })

    expect(result.current.error).toBeNull()
  })

  it('pushes completion and star changes for a linked todo', async () => {
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.toggleTodo('todo-2')
    })
    await act(async () => {
      await result.current.toggleStar('todo-2')
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/microsoft/todo/push')
    expect(pushBody(fetchMock.mock.calls[0])).toEqual({
      todo_id: 'todo-2',
      action: 'update',
      changes: { completed: true },
    })
    expect(pushBody(fetchMock.mock.calls[1])).toEqual({
      todo_id: 'todo-2',
      action: 'update',
      changes: { starred: true },
    })
    expect(result.current.error).toBeNull()
  })

  it('pushes only the synced fields of an edit', async () => {
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.updateTodo('todo-2', { title: 'Renamed', due_time: '14:30', workspace_id: 'ws-1' })
    })

    expect(pushBody(fetchMock.mock.calls[0]).changes).toEqual({ title: 'Renamed', due_time: '14:30' })
  })

  it('keeps the change but warns when the push fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'offline' }) })
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.toggleTodo('todo-2')
    })

    expect(result.current.todos.find((t) => t.id === 'todo-2')?.completed_at).not.toBeNull()
    expect(result.current.error).toBe('Saved here, but not in Microsoft To Do: offline')
  })

  it('deletes the To Do task first, and keeps the todo if that fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'offline' }) })
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteTodo('todo-2')
    })

    expect(pushBody(fetchMock.mock.calls[0])).toEqual({ todo_id: 'todo-2', action: 'delete' })
    expect(result.current.todos.some((t) => t.id === 'todo-2')).toBe(true)
    expect(result.current.error).toContain('Not deleted')
  })

  it('syncTodos reports the pull state', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ state: 'needs_reconnect', error: 'Reconnect' }) })
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.syncTodos()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/microsoft/todo/pull', { method: 'POST' })
    expect(result.current.syncStatus).toEqual({ state: 'needs_reconnect', message: 'Reconnect', syncedAt: undefined })
  })

  it('syncTodos reports an unreachable route without throwing', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useTodos('2026-08-05'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.syncTodos()
    })

    expect(result.current.syncStatus.state).toBe('error')
    expect(result.current.error).toBeNull()
  })
})
