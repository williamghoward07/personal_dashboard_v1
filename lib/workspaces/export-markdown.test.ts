import { describe, expect, it } from 'vitest'
import { buildWorkspaceMarkdown, workspaceExportFilename } from './export-markdown'
import type { Todo, Workspace, WorkspaceLink, WorkspaceLinkTodo, WorkspaceNote } from '@/lib/types'

function workspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    title: 'Coastal Erosion Essay',
    subtitle: 'AQA Geography Module 4',
    archived_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function link(overrides: Partial<WorkspaceLink> = {}): WorkspaceLink {
  return {
    id: `link-${Math.random()}`,
    workspace_id: 'ws-1',
    title: 'data.gov.uk',
    url: 'https://data.gov.uk/dataset/holderness.csv',
    favicon_path: null,
    position: 0,
    kind: 'data',
    citation: null,
    doi: null,
    meta_label: null,
    created_at: '2026-08-02T00:00:00.000Z',
    ...overrides,
  }
}

function todo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: `todo-${Math.random()}`,
    title: 'Extract recession rate',
    notes: null,
    due_date: null,
    due_time: null,
    completed_at: null,
    created_at: '2026-08-03T00:00:00.000Z',
    caldav_uid: null,
    list_id: null,
    parent_id: null,
    notes_document_id: null,
    workspace_id: 'ws-1',
    ...overrides,
  }
}

function note(overrides: Partial<WorkspaceNote> = {}): WorkspaceNote {
  return {
    id: `note-${Math.random()}`,
    workspace_id: 'ws-1',
    body: 'Key realization about the gas terminal trade-off.',
    kind: 'realization',
    footnote: null,
    created_at: '2026-08-04T14:15:00.000Z',
    ...overrides,
  }
}

const empty = { links: [], todos: [], notes: [], linkTodos: [] }

describe('buildWorkspaceMarkdown', () => {
  it('leads with the title and subtitle', () => {
    const md = buildWorkspaceMarkdown({ workspace: workspace(), ...empty })
    expect(md.startsWith('# Coastal Erosion Essay\n*AQA Geography Module 4*')).toBe(true)
  })

  it('omits the subtitle line when there is none', () => {
    const md = buildWorkspaceMarkdown({ workspace: workspace({ subtitle: null }), ...empty })
    expect(md).not.toContain('**\n*')
    expect(md).toContain('# Coastal Erosion Essay')
  })

  it('marks an archived workspace as archived', () => {
    const active = buildWorkspaceMarkdown({ workspace: workspace(), ...empty })
    expect(active).toContain('Active')

    const archived = buildWorkspaceMarkdown({
      workspace: workspace({ archived_at: '2026-09-01T00:00:00.000Z' }),
      ...empty,
    })
    expect(archived).toContain('Archived')
  })

  it('renders each section with its count, and an empty marker when blank', () => {
    const md = buildWorkspaceMarkdown({ workspace: workspace(), ...empty })
    expect(md).toContain('## Sources (0)')
    expect(md).toContain('## Scoped actions (0)')
    expect(md).toContain('## Thinking log (0)')
    expect(md).toContain('_No sources._')
    expect(md).toContain('_No scoped actions._')
    expect(md).toContain('_No log entries._')
  })

  it('includes a source with its url, kind and optional citation/DOI', () => {
    const md = buildWorkspaceMarkdown({
      workspace: workspace(),
      ...empty,
      links: [link({ title: 'Holderness Data', citation: 'Defra (2024)', doi: '10.1038/x', meta_label: '4.2 MB' })],
    })
    expect(md).toContain('- **Holderness Data** — <https://data.gov.uk/dataset/holderness.csv>')
    expect(md).toContain('Data · 4.2 MB')
    expect(md).toContain('Citation: Defra (2024)')
    expect(md).toContain('DOI: 10.1038/x')
  })

  it('omits citation and DOI lines when unset', () => {
    const md = buildWorkspaceMarkdown({ workspace: workspace(), ...empty, links: [link()] })
    expect(md).not.toContain('Citation:')
    expect(md).not.toContain('DOI:')
  })

  it('lists todos attached to a source', () => {
    const attachedTodo = todo({ id: 'todo-1', title: 'Review methodology' })
    const source = link({ id: 'link-1' })
    const linkTodos: WorkspaceLinkTodo[] = [
      { id: 'j-1', workspace_link_id: 'link-1', todo_id: 'todo-1', created_at: '2026-08-05T00:00:00.000Z' },
    ]

    const md = buildWorkspaceMarkdown({
      workspace: workspace(),
      links: [source],
      todos: [attachedTodo],
      notes: [],
      linkTodos,
    })
    expect(md).toContain('Linked todos: Review methodology')
  })

  it('checks off completed todos and annotates due dates and Reminders origin', () => {
    const md = buildWorkspaceMarkdown({
      workspace: workspace(),
      ...empty,
      todos: [
        todo({ title: 'Done thing', completed_at: '2026-08-06T00:00:00.000Z' }),
        todo({ title: 'Due thing', due_date: '2026-10-24', due_time: '09:00' }),
        todo({ title: 'Synced thing', caldav_uid: 'abc' }),
      ],
    })
    expect(md).toContain('- [x] Done thing')
    expect(md).toContain('- [ ] Due thing _(due 2026-10-24 09:00)_')
    expect(md).toContain('- [ ] Synced thing _(from Reminders)_')
  })

  it('renders log entries with their kind label, body and footnote', () => {
    const md = buildWorkspaceMarkdown({
      workspace: workspace(),
      ...empty,
      notes: [
        note({ body: 'Longshore drift shifts.', kind: 'argument', footnote: 'Corroborates the wave model' }),
        note({ body: 'Plain entry.', kind: 'note' }),
      ],
    })
    expect(md).toContain('### Argument Angle')
    expect(md).toContain('Longshore drift shifts.')
    expect(md).toContain('_Corroborates the wave model_')
    expect(md).toContain('### Note')
    expect(md).toContain('Plain entry.')
  })
})

describe('workspaceExportFilename', () => {
  it('slugifies the title', () => {
    expect(workspaceExportFilename(workspace())).toBe('coastal-erosion-essay.md')
  })

  it('strips punctuation and collapses separators', () => {
    expect(workspaceExportFilename(workspace({ title: '  Essay #2: Rivers & Coasts!  ' }))).toBe(
      'essay-2-rivers-coasts.md'
    )
  })

  it('falls back when the title has no usable characters', () => {
    expect(workspaceExportFilename(workspace({ title: '!!!' }))).toBe('workspace.md')
  })
})
