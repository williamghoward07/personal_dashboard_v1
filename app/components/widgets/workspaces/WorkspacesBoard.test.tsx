import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WorkspacesBoard from './WorkspacesBoard'

const { push, createWorkspace, createFolder, archiveWorkspace } = vi.hoisted(() => ({
  push: vi.fn(), createWorkspace: vi.fn(), createFolder: vi.fn(), archiveWorkspace: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: React.ComponentProps<'a'>) => <a href={href} {...props}>{children}</a> }))
vi.mock('@/lib/workspaces/use-workspaces', () => ({ useWorkspaces: () => ({
  workspaces: [
    { id: 'w1', title: 'Coastal systems', subtitle: 'Essay', folder_id: 'f1', archived_at: null, created_at: '2026-01-01', hidden_sections: [] },
    { id: 'w2', title: 'Fieldwork', subtitle: 'Research', folder_id: 'f1', archived_at: null, created_at: '2026-01-01', hidden_sections: [] },
  ],
  loading: false, error: null, createWorkspace, archiveWorkspace, updateWorkspace: vi.fn(), unarchiveWorkspace: vi.fn(), refresh: vi.fn(),
}) }))
vi.mock('@/lib/workspaces/use-workspace-folders', () => ({ useWorkspaceFolders: () => ({
  folders: [{ id: 'f1', name: 'Geography', parent_id: null, sort_order: 0, color: null }],
  loading: false, error: null, createFolder, updateFolder: vi.fn(), deleteFolder: vi.fn(),
}) }))
vi.mock('@/lib/workspaces/use-study-progress', () => ({ useStudyProgress: () => new Map([['w1', { readings: { done: 2, total: 3, percent: 67 }, minutesThisWeek: 60 }]]) }))
vi.mock('@/lib/workspaces/use-workspace-todos', () => ({ useWorkspaceTodos: () => ({ todos: [{ id: 't1', title: 'Read chapter', completed_at: null }], loading: false }) }))
vi.mock('@/lib/workspaces/use-workspace-links', () => ({ useWorkspaceLinks: () => ({ links: [], loading: false }) }))
vi.mock('./WorkspaceAppearanceMenu', () => ({ default: ({ onArchive }: { onArchive?: () => void }) => <button onClick={onArchive}>Archive Coastal systems</button> }))
vi.mock('./WorkspacesHelp', () => ({ default: () => null }))

let desktop = false
let changeMode: (() => void) | undefined
const show = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', '') })
const showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', '') })
const close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute('open') })
beforeEach(() => {
  desktop = false
  changeMode = undefined
  vi.stubGlobal('matchMedia', () => ({ get matches() { return desktop }, addEventListener: (_: string, listener: () => void) => { changeMode = listener }, removeEventListener: () => { changeMode = undefined } }))
  vi.stubGlobal('HTMLDialogElement', HTMLDialogElement)
  HTMLDialogElement.prototype.show = show
  HTMLDialogElement.prototype.showModal = showModal
  HTMLDialogElement.prototype.close = close
})
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals() })

describe('workspace browsing', () => {
  it('shows live list progress, opens and closes the scoped preview, and links to the desk', () => {
    render(<WorkspacesBoard folderId="f1" />)
    expect(screen.getByText(/Readings: 2 \/ 3/)).toBeTruthy()
    const row = screen.getByRole('button', { name: /Coastal systems.*Readings/ })
    row.focus()
    fireEvent.click(row)
    expect(showModal).toHaveBeenCalledOnce()
    expect(show).not.toHaveBeenCalled()
    expect(screen.getByText('○ Read chapter')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open workspace' }).getAttribute('href')).toBe('/workspaces/w1')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Back' }))
    fireEvent(screen.getByRole('dialog', { name: 'Coastal systems preview' }), new Event('cancel', { bubbles: false, cancelable: true }))
    expect(screen.queryByText('○ Read chapter')).toBeNull()
    expect(document.activeElement).toBe(row)
    fireEvent.click(row)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(document.activeElement).toBe(row)
  })

  it('keeps the desktop preview inline while selecting another workspace', () => {
    desktop = true
    render(<WorkspacesBoard folderId="f1" />)
    const first = screen.getByRole('button', { name: /Coastal systems.*Readings/ })
    first.focus()
    fireEvent.click(first)
    expect(show).toHaveBeenCalledOnce()
    expect(showModal).not.toHaveBeenCalled()
    const second = screen.getByRole('button', { name: /Fieldwork.*Readings/ })
    second.focus()
    fireEvent.click(second)
    expect(screen.getByRole('dialog', { name: 'Fieldwork preview' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open workspace' }).getAttribute('href')).toBe('/workspaces/w2')
    expect(document.activeElement).toBe(second)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(document.activeElement).toBe(second)
  })

  it('switches dialog mode when the viewport crosses the breakpoint', () => {
    desktop = true
    render(<WorkspacesBoard folderId="f1" />)
    fireEvent.click(screen.getByRole('button', { name: /Coastal systems.*Readings/ }))
    desktop = false
    changeMode?.()
    expect(close).toHaveBeenCalledOnce()
    expect(showModal).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(changeMode).toBeUndefined()
  })

  it('distinguishes search misses from an empty folder', () => {
    render(<WorkspacesBoard folderId="f1" />)
    fireEvent.change(screen.getByLabelText('Search workspaces'), { target: { value: 'missing' } })
    expect(screen.getByText('No workspaces match this search.')).toBeTruthy()
  })

  it('switches to cards, browses folders, and archives from the list', () => {
    render(<WorkspacesBoard folderId="f1" />)
    fireEvent.click(screen.getByRole('button', { name: 'cards' }))
    expect(screen.getByRole('link', { name: /Coastal systems/ }).getAttribute('href')).toBe('/workspaces/w1')
    fireEvent.click(screen.getByRole('button', { name: 'list' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Archive Coastal systems' })[0])
    expect(archiveWorkspace).toHaveBeenCalledWith('w1')
    fireEvent.change(screen.getByLabelText('Choose folder'), { target: { value: '' } })
    expect(push).toHaveBeenCalledWith('/workspaces')
  })
})
