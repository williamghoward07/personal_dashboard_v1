import type { Todo, Workspace, WorkspaceLink, WorkspaceLinkTodo, WorkspaceNote, WorkspaceTimeLog } from '@/lib/types'
import { partitionLinks } from './completed'
import { groupByWeek, readingProgress, splitReadings } from './readings'
import { formatMinutes, totalMinutes } from './time'
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
 * The whole workspace as one Markdown document — sources, weekly readings,
 * scoped actions, study time and the full thinking log. Pure and synchronous so it can be unit-tested
 * without a DOM; the caller wraps the string in a Blob download.
 */
export function buildWorkspaceMarkdown({
  workspace,
  links: allLinks,
  todos,
  notes,
  linkTodos,
  timeLogs = [],
}: {
  workspace: Workspace
  links: WorkspaceLink[]
  todos: Todo[]
  notes: WorkspaceNote[]
  linkTodos: WorkspaceLinkTodo[]
  timeLogs?: WorkspaceTimeLog[]
}): string {
  const lines: string[] = []
  const { sources: links, readings } = splitReadings(allLinks)

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
    const pushSource = (link: WorkspaceLink) => {
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

    const { open, completed } = partitionLinks(links, new Set())
    for (const link of open) pushSource(link)
    if (completed.length > 0) {
      if (open.length > 0) lines.push('')
      lines.push(`### Completed (${completed.length})`)
      lines.push('')
      for (const link of completed) pushSource(link)
    }
  }
  lines.push('')

  const pushReading = (link: WorkspaceLink) => {
    lines.push(`- [${link.completed_at ? 'x' : ' '}] **${link.title}** — <${link.url}>`)
    if (link.citation) lines.push(`  - Citation: ${link.citation}`)
  }

  if (readings.length > 0) {
    const overall = readingProgress(readings)
    lines.push(`## Readings (${overall.done}/${overall.total} read)`)
    for (const group of groupByWeek(readings)) {
      lines.push('')
      lines.push(`### Week ${group.week} (${group.progress.done}/${group.progress.total})`)
      lines.push('')
      for (const link of group.links) pushReading(link)
    }
    const unweeked = readings.filter((r) => r.week === null || r.week === undefined)
    if (unweeked.length > 0) {
      lines.push('')
      lines.push(`### Lecture readings (${readingProgress(unweeked).done}/${unweeked.length})`)
      lines.push('')
      for (const link of unweeked) pushReading(link)
    }
    lines.push('')
  }

  if (timeLogs.length > 0) {
    lines.push(`## Study time (${formatMinutes(totalMinutes(timeLogs))} total)`)
    lines.push('')
    for (const log of [...timeLogs].sort((a, b) => a.day.localeCompare(b.day))) {
      lines.push(`- ${log.day} — ${formatMinutes(log.minutes)}${log.note ? ` · ${log.note}` : ''}`)
    }
    lines.push('')
  }

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
