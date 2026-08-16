import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTodos } from './use-todos'

const { mockState } = vi.hoisted(() => ({
  mockState: { updateShouldFail: false },
}))

// Mimics supabase-js's PostgrestFilterBuilder: each chain method returns
// another chainable object, and the final link is "thenable" so `await`
// resolves it like a real query response ({ data, error }).
function thenable<T>(result: T) {
  return { then: (resolve: (value: T) => void) => Promise.resolve(result).then(resolve) }
}

vi.mock('@/lib/supabase', () => {
  const existingTodo = {
    id: 'todo-1',
    title: 'Existing todo',
    notes: null,
    due_date: '2026-08-05',
    completed_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
  }

  return {
    supabase: {
      from: () => ({
        select: () => ({
          or: () => ({
            order: () => thenable({ data: [existingTodo], error: null }),
          }),
        }),
        update: () => ({
          eq: () =>
            thenable(
              mockState.updateShouldFail ? { error: { message: 'network error' } } : { error: null }
            ),
        }),
        insert: () => ({
          select: () => ({ single: () => thenable({ data: null, error: null }) }),
        }),
      }),
    },
  }
})

describe('useTodos optimistic toggle', () => {
  beforeEach(() => {
    mockState.updateShouldFail = false
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
