'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Archive, ArchiveRestore, ArrowLeft, ExternalLink, Pencil, Plus } from 'lucide-react'
import { useWorkspaces } from '@/lib/workspaces/use-workspaces'
import { useWorkspaceLinks } from '@/lib/workspaces/use-workspace-links'
import { useWorkspaceTodos } from '@/lib/workspaces/use-workspace-todos'
import { useWorkspaceLinkTodos } from '@/lib/workspaces/use-workspace-link-todos'
import { useWorkspaceNotes } from '@/lib/workspaces/use-workspace-notes'
import { useWorkspaceSessions } from '@/lib/workspaces/use-workspace-sessions'
import LinksSection from './LinksSection'
import TodosSection from './TodosSection'
import NotesSection from './NotesSection'
import WorkspaceHeaderStrip from './WorkspaceHeaderStrip'
import WorkspaceTabStrip from './WorkspaceTabStrip'
import WorkspaceStatCards from './WorkspaceStatCards'
import WorkspaceFooter from './WorkspaceFooter'
import { actionButtonClass, inputClass, primaryButtonClass, relativeTime } from './shared'

const pageClass = 'mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6'

export default function WorkspaceDetailBoard({ workspaceId }: { workspaceId: string }) {
  const { workspaces, loading: workspacesLoading, updateWorkspace, archiveWorkspace, unarchiveWorkspace } =
    useWorkspaces()
  const linksApi = useWorkspaceLinks(workspaceId)
  const todosApi = useWorkspaceTodos(workspaceId)
  const linkTodosApi = useWorkspaceLinkTodos()
  const notesApi = useWorkspaceNotes(workspaceId)
  const notes = notesApi.notes
  const { sessionCount, lastSessionAt } = useWorkspaceSessions(workspaceId)

  const [editingSubtitle, setEditingSubtitle] = useState(false)
  const [subtitleDraft, setSubtitleDraft] = useState('')
  const [addingSource, setAddingSource] = useState(false)

  const workspace = workspaces.find((w) => w.id === workspaceId)

  if (workspacesLoading) {
    return (
      <main className={pageClass}>
        <p className="text-sm text-on-surface-variant">Loading...</p>
      </main>
    )
  }

  if (!workspace) {
    return (
      <main className={pageClass}>
        <Link
          href="/workspaces"
          className="flex w-fit items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to Workspaces
        </Link>
        <p className="text-sm text-on-surface-variant">Workspace not found.</p>
      </main>
    )
  }

  const isArchived = !!workspace.archived_at
  const lastSession = relativeTime(lastSessionAt)
  const openAll = () => linksApi.links.forEach((l) => window.open(l.url, '_blank', 'noopener,noreferrer'))

  return (
    <main className={pageClass}>
      <WorkspaceHeaderStrip context={isArchived ? 'Archived Context' : 'Active Context'} />

      <WorkspaceTabStrip workspaces={workspaces} currentId={workspaceId} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-headline-lg font-bold text-workspace-teal">{workspace.title}</h1>

            {editingSubtitle ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  await updateWorkspace(workspace.id, { subtitle: subtitleDraft.trim() || null })
                  setEditingSubtitle(false)
                }}
                className="flex items-center gap-2"
              >
                <input
                  autoFocus
                  value={subtitleDraft}
                  onChange={(e) => setSubtitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditingSubtitle(false)
                  }}
                  placeholder="e.g. AQA Geography Module 4"
                  className={inputClass}
                />
                <button type="submit" className={primaryButtonClass}>
                  Save
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSubtitleDraft(workspace.subtitle ?? '')
                  setEditingSubtitle(true)
                }}
                className="flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-on-surface"
              >
                {workspace.subtitle || 'Add context'}
                <Pencil className="h-3 w-3 opacity-50" strokeWidth={1.75} />
              </button>
            )}
          </div>

          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-on-surface-variant">
            {lastSession && (
              <>
                <span>Last session {lastSession}</span>
                <span className="text-on-surface-variant/40">·</span>
              </>
            )}
            <span>
              {linksApi.links.length} {linksApi.links.length === 1 ? 'source' : 'sources'}
            </span>
            <span className="text-on-surface-variant/40">·</span>
            <span>
              {todosApi.todos.length} scoped {todosApi.todos.length === 1 ? 'action' : 'actions'}
            </span>
            <span className="text-on-surface-variant/40">·</span>
            <span>
              {notes.length} thinking {notes.length === 1 ? 'log' : 'logs'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openAll}
            disabled={linksApi.links.length === 0}
            className={primaryButtonClass}
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
            Open all in working set ({linksApi.links.length})
          </button>

          <button type="button" onClick={() => setAddingSource(true)} className={actionButtonClass}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add source
          </button>

          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              isArchived
                ? 'border-outline-variant bg-surface-container-highest text-on-surface-variant'
                : 'border-workspace-teal/30 bg-workspace-teal/10 text-workspace-teal'
            }`}
          >
            Lifecycle: {isArchived ? 'Archived' : 'Active'}
          </span>

          <button
            type="button"
            onClick={() => (isArchived ? unarchiveWorkspace(workspace.id) : archiveWorkspace(workspace.id))}
            className={actionButtonClass}
          >
            {isArchived ? (
              <>
                <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={1.75} />
                Unarchive
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
                Archive
              </>
            )}
          </button>
        </div>
      </div>

      {(linksApi.error || todosApi.error || linkTodosApi.error) && (
        <p role="alert" className="text-sm text-error">
          {linksApi.error || todosApi.error || linkTodosApi.error}
        </p>
      )}

      <WorkspaceStatCards
        links={linksApi.links}
        todos={todosApi.todos}
        notes={notes}
        linkTodos={linkTodosApi.linkTodos}
      />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <LinksSection
          links={linksApi.links}
          loading={linksApi.loading}
          addLink={linksApi.addLink}
          updateLink={linksApi.updateLink}
          deleteLink={linksApi.deleteLink}
          reorderLinks={linksApi.reorderLinks}
          todos={todosApi.todos}
          linkTodos={linkTodosApi.linkTodos}
          attachTodosToLink={linkTodosApi.attachTodosToLink}
          detachLinkTodo={linkTodosApi.detach}
          addingUrl={addingSource}
          setAddingUrl={setAddingSource}
        />

        <TodosSection
          workspaceId={workspaceId}
          todos={todosApi.todos}
          loading={todosApi.loading}
          addTodo={todosApi.addTodo}
          attachTodos={todosApi.attachTodos}
          detachTodo={todosApi.detachTodo}
          toggleTodo={todosApi.toggleTodo}
          deleteTodo={todosApi.deleteTodo}
          links={linksApi.links}
          linkTodos={linkTodosApi.linkTodos}
          attachLinksToTodo={linkTodosApi.attachLinksToTodo}
          detachLinkTodo={linkTodosApi.detach}
        />

        <NotesSection
          notes={notes}
          loading={notesApi.loading}
          error={notesApi.error}
          addNote={notesApi.addNote}
        />
      </div>

      <WorkspaceFooter
        workspace={workspace}
        links={linksApi.links}
        todos={todosApi.todos}
        notes={notes}
        linkTodos={linkTodosApi.linkTodos}
        sessionCount={sessionCount}
      />
    </main>
  )
}
