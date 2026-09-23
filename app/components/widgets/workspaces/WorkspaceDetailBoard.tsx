'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Archive, ArchiveRestore, ArrowLeft, BarChart3, Brain, FolderOpen, ListChecks, Pencil, Plus } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import type { WorkspaceSectionKey } from '@/lib/types'
import { usePageTitle } from '@/lib/page-title'
import { useWorkspaces } from '@/lib/workspaces/use-workspaces'
import { useWorkspaceFolders } from '@/lib/workspaces/use-workspace-folders'
import { useWorkspaceLinks } from '@/lib/workspaces/use-workspace-links'
import { useWorkspaceTodos } from '@/lib/workspaces/use-workspace-todos'
import { useWorkspaceLinkTodos } from '@/lib/workspaces/use-workspace-link-todos'
import { useAllNoteTags, useWorkspaceNotes } from '@/lib/workspaces/use-workspace-notes'
import { useWorkspaceSessions } from '@/lib/workspaces/use-workspace-sessions'
import { folderPath, resolveAccent } from '@/lib/workspaces/folders'
import { COLUMN_GRID_CLASS, SECTION_LABELS, columnLayout, isShown, toggleSection, visibleStatCards } from '@/lib/workspaces/layout'
import LinksSection from './LinksSection'
import TodosSection from './TodosSection'
import NotesSection from './NotesSection'
import WorkspaceHeaderStrip from './WorkspaceHeaderStrip'
import WorkspaceTabStrip from './WorkspaceTabStrip'
import WorkspaceStatCards from './WorkspaceStatCards'
import WorkspaceFooter from './WorkspaceFooter'
import LaunchSetButton from './LaunchSetButton'
import WorkspacesHelp from './WorkspacesHelp'
import WorkspaceLayoutMenu from './WorkspaceLayoutMenu'
import WorkspaceAppearanceMenu from './WorkspaceAppearanceMenu'
import { CollapseButton, CollapsedSectionBar } from './SectionChrome'
import { accentVars, actionButtonClass, inputClass, logTimestamp, primaryButtonClass, relativeTime } from './shared'

const pageClass = 'mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 pt-6 pb-48'

const BAR_GRID_CLASS: Record<number, string> = {
  1: '',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-4',
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export default function WorkspaceDetailBoard({ workspaceId }: { workspaceId: string }) {
  const { workspaces, loading: workspacesLoading, updateWorkspace, archiveWorkspace, unarchiveWorkspace } =
    useWorkspaces()
  const { folders, error: foldersError } = useWorkspaceFolders()
  const linksApi = useWorkspaceLinks(workspaceId)
  const todosApi = useWorkspaceTodos(workspaceId)
  const linkTodosApi = useWorkspaceLinkTodos()
  const notesApi = useWorkspaceNotes(workspaceId)
  const notes = notesApi.notes
  const tagPool = useAllNoteTags()
  const { sessionCount, lastSessionAt } = useWorkspaceSessions(workspaceId)

  const [editingSubtitle, setEditingSubtitle] = useState(false)
  const [subtitleDraft, setSubtitleDraft] = useState('')
  const [addingSource, setAddingSource] = useState(false)

  const workspace = workspaces.find((w) => w.id === workspaceId)

  // Publishes the workspace name to the top-bar breadcrumb and the browser tab.
  // Undefined while loading, so both fall back to the plain "Workspaces" module
  // label. Must stay above the early returns below — it is a hook.
  usePageTitle(workspace?.title)

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
  const accent = resolveAccent(workspace, folders)
  const crumbs = folderPath(folders, workspace.folder_id).map((f) => ({
    label: f.name,
    href: `/workspaces?folder=${f.id}`,
  }))
  const siblings = workspaces.filter((w) => (w.folder_id ?? null) === (workspace.folder_id ?? null))

  const hidden = workspace.hidden_sections ?? []
  const collapsed = workspace.collapsed_sections ?? []
  const shown = (key: WorkspaceSectionKey) => isShown(hidden, key)
  const statCards = visibleStatCards(hidden)
  const statsCollapsed = collapsed.includes('stats') && statCards.length > 0
  const columns = columnLayout(hidden, collapsed)

  const toggleHidden = (key: WorkspaceSectionKey) =>
    updateWorkspace(workspace.id, { hidden_sections: toggleSection(hidden, key) })
  const toggleCollapsed = (key: WorkspaceSectionKey) =>
    updateWorkspace(workspace.id, { collapsed_sections: toggleSection(collapsed, key) })

  const openTodos = todosApi.todos.filter((t) => !t.completed_at).length
  const doneTodos = todosApi.todos.length - openTodos

  const addSource = () => {
    if (collapsed.includes('sources')) toggleCollapsed('sources')
    setAddingSource(true)
  }

  const collapsedBars = [
    statsCollapsed && (
      <CollapsedSectionBar
        key="stats"
        label={SECTION_LABELS.stats}
        Icon={BarChart3}
        onExpand={() => toggleCollapsed('stats')}
        summary={[
          shown('actions') && `${doneTodos}/${todosApi.todos.length} actions done`,
          shown('sources') && plural(linksApi.links.length, 'source', 'sources'),
          shown('log') && plural(notes.length, 'log entry', 'log entries'),
        ]
          .filter(Boolean)
          .join(' · ')}
      />
    ),
    columns.collapsed.includes('sources') && (
      <CollapsedSectionBar
        key="sources"
        label="Scoped sources"
        Icon={FolderOpen}
        onExpand={() => toggleCollapsed('sources')}
        summary={plural(linksApi.links.length, 'source', 'sources')}
      />
    ),
    columns.collapsed.includes('actions') && (
      <CollapsedSectionBar
        key="actions"
        label="Scoped next actions"
        Icon={ListChecks}
        onExpand={() => toggleCollapsed('actions')}
        summary={`${openTodos} open · ${doneTodos} done`}
      />
    ),
    columns.collapsed.includes('log') && (
      <CollapsedSectionBar
        key="log"
        label="Thinking log"
        Icon={Brain}
        onExpand={() => toggleCollapsed('log')}
        summary={
          notes.length === 0
            ? 'No entries yet'
            : `${plural(notes.length, 'entry', 'entries')} · latest ${logTimestamp(notes[0].created_at)}`
        }
      />
    ),
  ].filter(Boolean)

  const sections = {
    sources: (
      <LinksSection
        key="sources"
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
        onCollapse={() => toggleCollapsed('sources')}
      />
    ),
    actions: (
      <TodosSection
        key="actions"
        todos={todosApi.todos}
        loading={todosApi.loading}
        addTodo={todosApi.addTodo}
        attachTodos={todosApi.attachTodos}
        detachTodo={todosApi.detachTodo}
        toggleTodo={todosApi.toggleTodo}
        toggleStar={todosApi.toggleStar}
        deleteTodo={todosApi.deleteTodo}
        links={linksApi.links}
        linkTodos={linkTodosApi.linkTodos}
        attachLinksToTodo={linkTodosApi.attachLinksToTodo}
        detachLinkTodo={linkTodosApi.detach}
        onCollapse={() => toggleCollapsed('actions')}
      />
    ),
    log: (
      <NotesSection
        key="log"
        notes={notes}
        loading={notesApi.loading}
        error={notesApi.error}
        addNote={notesApi.addNote}
        tagPool={tagPool}
        onCollapse={() => toggleCollapsed('log')}
      />
    ),
  }

  const error = linksApi.error || todosApi.error || linkTodosApi.error || foldersError

  return (
    <main className={pageClass} style={accentVars(accent)}>
      <WorkspaceHeaderStrip context={isArchived ? 'Archived Context' : 'Active Context'} crumbs={crumbs} />

      <WorkspaceTabStrip
        workspaces={siblings}
        currentId={workspaceId}
        accentOf={(w) => resolveAccent(w, folders)}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="font-display text-headline-lg font-bold text-ws-accent">{workspace.title}</h1>
            <WorkspaceAppearanceMenu
              workspace={workspace}
              folders={folders}
              onChange={(patch) => updateWorkspace(workspace.id, patch)}
            />
            <WorkspacesHelp />

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
            {[
              lastSession && `Last session ${lastSession}`,
              shown('sources') && plural(linksApi.links.length, 'source', 'sources'),
              shown('actions') && `${todosApi.todos.length} scoped ${todosApi.todos.length === 1 ? 'action' : 'actions'}`,
              shown('log') && plural(notes.length, 'thinking log', 'thinking logs'),
            ]
              .filter(Boolean)
              .map((item, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-on-surface-variant/40">·</span>}
                  {item}
                </span>
              ))}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {shown('sources') && (
            <>
              <LaunchSetButton links={linksApi.links} />
              <button type="button" onClick={addSource} className={actionButtonClass}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Add source
              </button>
            </>
          )}

          <WorkspaceLayoutMenu hidden={hidden} onToggle={toggleHidden} />

          <StatusBadge accent={isArchived ? 'neutral' : 'ws'}>
            Lifecycle: {isArchived ? 'Archived' : 'Active'}
          </StatusBadge>

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

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      {statCards.length > 0 && !statsCollapsed && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-end">
            <CollapseButton label="Stats" onClick={() => toggleCollapsed('stats')} />
          </div>
          <WorkspaceStatCards
            cards={statCards}
            links={linksApi.links}
            todos={todosApi.todos}
            notes={notes}
            linkTodos={linkTodosApi.linkTodos}
          />
        </div>
      )}

      {collapsedBars.length > 0 && (
        <div className={`grid grid-cols-1 gap-2 ${BAR_GRID_CLASS[collapsedBars.length]}`}>{collapsedBars}</div>
      )}

      {columns.expanded.length > 0 ? (
        <div className={`grid grid-cols-1 items-start gap-4 ${COLUMN_GRID_CLASS[columns.expanded.length]}`}>
          {columns.expanded.map((key) => sections[key])}
        </div>
      ) : (
        columns.collapsed.length === 0 && (
          <p className="text-sm text-on-surface-variant">
            Every section is hidden on this workspace — use Layout to bring one back.
          </p>
        )
      )}

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
