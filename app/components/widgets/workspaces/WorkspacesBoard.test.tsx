import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WorkspacesBoard from './WorkspacesBoard'

const { push, createWorkspace, createFolder, archiveWorkspace } = vi.hoisted(() => ({
  push: vi.fn(), createWorkspace: vi.fn(), createFolder: vi.fn(), archiveWorkspace: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: React.ComponentProps<'a'>) => <a href={href} {...props}>{children}</a> }))
vi.mock('@/lib/workspaces/use-workspaces', () => ({ useWorkspaces: () => ({
  workspaces: [{ id: 'w1', title: 'Coastal systems', subtitle: 'Essay', folder_id: 'f1', archived_at: null, created_at: '2026-01-01', hidden_sections: [] }],
  loading: false, error: null, createWorkspace, archiveWorkspace, updateWorkspace: vi.fn(), unarchiveWorkspace: vi.fn(), refresh: vi.fn(),
}) }))
vi.mock('@/lib/workspaces/use-workspace-folders', () => ({ useWorkspaceFolders: () => ({
  folders: [{ id: 'f1', name: 'Geography', parent_id: null, sort_order: 0, color: null }],
  loading: false, error: null, createFolder, updateFolder: vi.fn(), deleteFolder: vi.fn(),
}) }))
vi.mock('@/lib/workspaces/use-study-progress', () => ({ useStudyProgress: () => new Map([['w1', { readings: { done: 2, total: 3, percent: 67 }, minutesThisWeek: 60 }]]) }))
vi.mock('@/lib/workspaces/use-workspace-todos', () => ({ useWorkspaceTodos: () => ({ todos: [{ id: 't1', title: 'Read chapter', completed_at: null }], loading: false }) }))
vi.mock('@/lib/workspaces/use-workspace-links', () => ({ useWorkspaceLinks: () => ({ links: [], loading: false }) }))
vi.mock('./WorkspaceAppearanceMenu', () => ({ default: () => <button>Move menu</button> }))
vi.mock('./WorkspacesHelp', () => ({ default: () => null }))

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('workspace browsing', () => {
  it('shows live list progress, opens and closes the scoped preview, and links to the desk', () => {
    render(<WorkspacesBoard folderId="f1" />)
    expect(screen.getByText(/Readings: 2 \/ 3/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Coastal systems.*Readings/ }))
    expect(screen.getByText('○ Read chapter')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open workspace' }).getAttribute('href')).toBe('/workspaces/w1')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.queryByText('○ Read chapter')).toBeNull()
  })

  it('switches to cards, browses folders, and archives from the list', () => {
    render(<WorkspacesBoard folderId="f1" />)
    fireEvent.click(screen.getByRole('button', { name: 'cards' }))
    expect(screen.getByRole('link', { name: /Coastal systems/ }).getAttribute('href')).toBe('/workspaces/w1')
    fireEvent.click(screen.getByRole('button', { name: 'list' }))
    fireEvent.click(screen.getByRole('button', { name: 'Archive Coastal systems' }))
    expect(archiveWorkspace).toHaveBeenCalledWith('w1')
    fireEvent.change(screen.getByLabelText('Choose folder'), { target: { value: '' } })
    expect(push).toHaveBeenCalledWith('/workspaces')
  })
})
