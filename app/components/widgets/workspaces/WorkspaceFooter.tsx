'use client'

import { Download } from 'lucide-react'
import type { Todo, Workspace, WorkspaceLink, WorkspaceLinkTodo, WorkspaceNote } from '@/lib/types'
import { buildWorkspaceMarkdown, workspaceExportFilename } from '@/lib/workspaces/export-markdown'
import { actionButtonClass, formatDate } from './shared'

export default function WorkspaceFooter({
  workspace,
  links,
  todos,
  notes,
  linkTodos,
  sessionCount,
}: {
  workspace: Workspace
  links: WorkspaceLink[]
  todos: Todo[]
  notes: WorkspaceNote[]
  linkTodos: WorkspaceLinkTodo[]
  sessionCount: number
}) {
  const exportBundle = () => {
    const markdown = buildWorkspaceMarkdown({ workspace, links, todos, notes, linkTodos })
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = workspaceExportFilename(workspace)
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/60 pt-4">
      <p className="text-xs text-on-surface-variant">
        Workspace created {formatDate(workspace.created_at)}
        {sessionCount > 0 && ` · ${sessionCount} session${sessionCount === 1 ? '' : 's'}`}
        <span className="text-on-surface-variant/60"> · Permanent record, zero auto-cleanup</span>
      </p>

      <button type="button" onClick={exportBundle} className={actionButtonClass}>
        <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
        Export Markdown bundle
      </button>
    </footer>
  )
}
