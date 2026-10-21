import { describe, expect, it } from 'vitest'
import { recentLogShare, sourceCoupling, sourceFootprint, taskProgress } from './stats'
import type { Todo, WorkspaceLink, WorkspaceLinkTodo, WorkspaceNote } from '@/lib/types'

function todo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: `todo-${Math.random()}`,
    title: 'Untitled',
    notes: null,
    due_date: null,
    due_time: null,
    completed_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    caldav_uid: null,
    mstodo_task_id: null,
    mstodo_list_id: null,
    mstodo_checklist_item_id: null,
    starred: false,
    list_id: null,
    parent_id: null,
    notes_document_id: null,
    workspace_id: 'ws-1',
    ...overrides,
  }
}

function link(overrides: Partial<WorkspaceLink> = {}): WorkspaceLink {
  return {
    id: `link-${Math.random()}`,
    workspace_id: 'ws-1',
    title: 'example.com',
    url: 'https://example.com',
    favicon_path: null,
    position: 0,
    kind: 'other',
    citation: null,
    doi: null,
    meta_label: null,
    completed_at: null,
    week: null,
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function note(createdAt: string): WorkspaceNote {
  return {
    id: `note-${Math.random()}`,
    workspace_id: 'ws-1',
    body: 'Entry',
    kind: 'note',
    footnote: null,
    tags: [],
    created_at: createdAt,
  }
}

describe('taskProgress', () => {
  it('is 0% for an empty list rather than NaN', () => {
    expect(taskProgress([])).toEqual({ completed: 0, percent: 0 })
  })

  it('counts completed todos and rounds the percentage', () => {
    const todos = [todo({ completed_at: '2026-08-02T00:00:00.000Z' }), todo(), todo()]
    expect(taskProgress(todos)).toEqual({ completed: 1, percent: 33 })
  })

  it('reports 100% when everything is done', () => {
    const todos = [todo({ completed_at: 'x' }), todo({ completed_at: 'y' })]
    expect(taskProgress(todos).percent).toBe(100)
  })
})

describe('sourceFootprint', () => {
  it('is empty and 0% with no sources', () => {
    expect(sourceFootprint([])).toEqual({ breakdown: '', percent: 0 })
  })

  it('summarises counts per kind in a fixed order and pluralises', () => {
    const links = [link({ kind: 'paper' }), link({ kind: 'paper' }), link({ kind: 'data' })]
    expect(sourceFootprint(links).breakdown).toBe('2 papers · 1 data')
  })

  it('treats only non-other kinds as classified', () => {
    const links = [link({ kind: 'paper' }), link({ kind: 'other' })]
    expect(sourceFootprint(links).percent).toBe(50)

    expect(sourceFootprint([link({ kind: 'other' })]).percent).toBe(0)
  })

  it('ignores completed sources', () => {
    const links = [
      link({ kind: 'paper' }),
      link({ kind: 'paper', completed_at: '2026-09-01T00:00:00.000Z' }),
    ]
    expect(sourceFootprint(links).breakdown).toBe('1 paper')
  })
})

describe('sourceCoupling', () => {
  const junction = (todoId: string): WorkspaceLinkTodo => ({
    id: `j-${Math.random()}`,
    workspace_link_id: 'link-1',
    todo_id: todoId,
    created_at: '2026-08-01T00:00:00.000Z',
  })

  it('is 0% with no todos', () => {
    expect(sourceCoupling([], [])).toEqual({ coupled: 0, percent: 0 })
  })

  it('counts each todo once even when linked to several sources', () => {
    const t = todo({ id: 'todo-1' })
    const linkTodos = [junction('todo-1'), { ...junction('todo-1'), workspace_link_id: 'link-2' }]
    expect(sourceCoupling([t, todo()], linkTodos)).toEqual({ coupled: 1, percent: 50 })
  })

  it('ignores junction rows pointing at todos outside this workspace', () => {
    expect(sourceCoupling([todo({ id: 'todo-1' })], [junction('todo-elsewhere')]).coupled).toBe(0)
  })
})

describe('recentLogShare', () => {
  const NOW = new Date('2026-09-16T12:00:00.000Z').getTime()

  it('is 0% with no entries', () => {
    expect(recentLogShare([], NOW)).toBe(0)
  })

  it('counts only entries inside the last 7 days', () => {
    const notes = [
      note('2026-09-15T12:00:00.000Z'), // yesterday
      note('2026-09-14T12:00:00.000Z'), // 2 days ago
      note('2026-08-01T12:00:00.000Z'), // well outside
      note('2026-07-01T12:00:00.000Z'), // well outside
    ]
    expect(recentLogShare(notes, NOW)).toBe(50)
  })

  it('is 100% when every entry is recent', () => {
    expect(recentLogShare([note('2026-09-16T09:00:00.000Z')], NOW)).toBe(100)
  })
})
