import type { Todo, Workspace, WorkspaceLink, WorkspaceLinkTodo, WorkspaceNote } from '@/lib/types'
import { NOTE_KINDS, SOURCE_KINDS } from './kinds'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * The whole workspace as one Markdown document — sources, scoped actions
 * and the full thinking log. Pure and synchronous so it can be unit-tested
 * without a DOM; the caller wraps the string in a Blob download.
 */
export function buildWorkspaceMarkdown({
  workspace,
  links,
  todos,
  notes,
  linkTodos,
}: {
  workspace: Workspace
  links: WorkspaceLink[]
  todos: Todo[]
  notes: WorkspaceNote[]
  linkTodos: WorkspaceLinkTodo[]
}): string {
  const lines: string[] = []

  lines.push(`# ${workspace.title}`)
  if (workspace.subtitle) lines.push(`*${workspace.subtitle}*`)
  lines.push('')
  lines.push(
    `Created ${formatDate(workspace.created_at)} · ${workspace.archived_at ? `Archived ${formatDate(workspace.archived_at)}` : 'Active'}`
  )
  lines.push('')

  lines.push(`## Sources (${links.length})`)
  lines.push('')
  if (links.length === 0) {
    lines.push('_No sources._')
  } else {
    for (const link of links) {
      const attachedTitles = linkTodos
        .filter((lt) => lt.workspace_link_id === link.id)
        .map((lt) => todos.find((t) => t.id === lt.todo_id)?.title)
        .filter((t): t is string => !!t)

      lines.push(`- **${link.title}** — <${link.url}>`)
      const meta = [SOURCE_KINDS[link.kind].label, link.meta_label, `added ${formatDate(link.created_at)}`]
        .filter(Boolean)
        .join(' · ')
      lines.push(`  - ${meta}`)
      if (link.citation) lines.push(`  - Citation: ${link.citation}`)
      if (link.doi) lines.push(`  - DOI: ${link.doi}`)
      if (attachedTitles.length > 0) lines.push(`  - Linked todos: ${attachedTitles.join('; ')}`)
    }
  }
  lines.push('')

  lines.push(`## Scoped actions (${todos.length})`)
  lines.push('')
  if (todos.length === 0) {
    lines.push('_No scoped actions._')
  } else {
    for (const todo of todos) {
      const box = todo.completed_at ? '[x]' : '[ ]'
      const detail = [
        todo.due_date ? `due ${todo.due_date}${todo.due_time ? ` ${todo.due_time}` : ''}` : null,
        todo.mstodo_task_id ? 'from To Do' : null,
      ]
        .filter(Boolean)
        .join(' · ')
      lines.push(`- ${box} ${todo.title}${detail ? ` _(${detail})_` : ''}`)
    }
  }
  lines.push('')

  lines.push(`## Thinking log (${notes.length})`)
  lines.push('')
  if (notes.length === 0) {
    lines.push('_No log entries._')
  } else {
    for (const note of notes) {
      lines.push(`### ${NOTE_KINDS[note.kind].label} — ${formatDateTime(note.created_at)}`)
      lines.push('')
      lines.push(note.body)
      if (note.footnote) {
        lines.push('')
        lines.push(`_${note.footnote}_`)
      }
      if (note.tags?.length) {
        lines.push('')
        lines.push(`Tags: ${note.tags.map((t) => `#${t}`).join(' ')}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

/** Filesystem-safe filename for the exported bundle. */
export function workspaceExportFilename(workspace: Workspace): string {
  const slug = workspace.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'workspace'}.md`
}
