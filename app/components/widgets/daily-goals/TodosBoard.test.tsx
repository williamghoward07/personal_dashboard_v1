import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import TodosBoard from './TodosBoard'

const mocks = vi.hoisted(() => ({ toggle: vi.fn(), star: vi.fn(), sync: vi.fn() }))
vi.mock('@/lib/daily-goals/use-todos', () => ({ useTodos: () => ({
  todos: [
    { id: 'one', title: 'Read chapter', notes: null, due_date: null, due_time: null, completed_at: null, created_at: '2026-01-01', starred: false, list_id: 'reading', parent_id: null, workspace_id: 'geo' },
    { id: 'two', title: 'Write essay', notes: null, due_date: null, due_time: null, completed_at: null, created_at: '2026-01-02', starred: true, list_id: null, parent_id: null, workspace_id: null },
  ], loading: false, error: null, addTodo: vi.fn(), toggleTodo: mocks.toggle, toggleStar: mocks.star, updateTodo: vi.fn(), deleteTodo: vi.fn(), syncTodos: mocks.sync, syncStatus: { state: 'idle' },
}) }))
vi.mock('@/lib/todos/use-todo-lists', () => ({ useTodoLists: () => ({ lists: [{ id: 'reading', name: 'Reading', color: '#eee' }], createList: vi.fn(), updateList: vi.fn(), deleteList: vi.fn() }) }))
vi.mock('@/lib/workspaces/use-workspace-lookup', () => ({ useWorkspaceLookup: () => new Map([['geo', { id: 'geo', title: 'Geography', accent: 'sage', archived: false }]]) }))
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) } }))
vi.mock('@/lib/microsoft/connect-errors', () => ({ takeMicrosoftConnectResult: () => null }))
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('Tasks board', () => {
  it('opens details and returns focus to the filtered list', async () => {
    render(<TodosBoard />)
    fireEvent.click(screen.getByRole('button', { name: 'Reading' }))
    expect(screen.queryByText('Write essay')).toBeNull()
    const row = screen.getByText('Read chapter').closest('button') as HTMLElement
    row.focus()
    fireEvent.click(row)
    expect(within(screen.getByLabelText('Task details')).getByText('Read chapter')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to tasks' }))
    expect(screen.queryByLabelText('Task details')).toBeNull()
    expect(screen.getByText('Read chapter')).toBeTruthy()
    expect(screen.queryByText('Write essay')).toBeNull()
    expect(screen.getByRole('button', { name: 'Reading' }).getAttribute('aria-pressed')).toBe('true')
    await waitFor(() => expect(document.activeElement).toBe(row))
  })
  it('closes details on Escape and retains the selected filter', async () => {
    render(<TodosBoard />)
    fireEvent.click(screen.getByRole('button', { name: 'Reading' }))
    const opener = screen.getByText('Read chapter').closest('button') as HTMLElement
    fireEvent.click(opener)
    fireEvent(screen.getByRole('dialog', { name: 'Task details' }), new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog', { name: 'Task details' })).toBeNull()
    expect(screen.queryByText('Write essay')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })
  it('filters by workspace and search and calls existing completion and star mutations', () => {
    render(<TodosBoard />)
    fireEvent.change(screen.getByLabelText('Choose a list or workspace'), { target: { value: 'workspace:geo' } })
    expect(screen.queryByText('Write essay')).toBeNull()
    fireEvent.change(screen.getByLabelText('Search tasks'), { target: { value: 'chapter' } })
    fireEvent.click(screen.getByLabelText('Mark "Read chapter" complete'))
    fireEvent.click(screen.getByLabelText('Star Read chapter'))
    expect(mocks.toggle).toHaveBeenCalledWith('one')
    expect(mocks.star).toHaveBeenCalledWith('one')
  })
})
