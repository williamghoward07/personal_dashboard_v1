'use client'

import styles from './workspace-surface.module.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Clock,
  Folder,
  FolderKanban,
  FolderPlus,
  GripVertical,
  Plus,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { StatusBadge } from '@/components/ui/status-badge'
import type { Accent } from '@/lib/theme'
import type { Workspace, WorkspaceFolder } from '@/lib/types'
import { useWorkspaces } from '@/lib/workspaces/use-workspaces'
import { isModuleWorkspace } from '@/lib/lectures/module-workspace'
import { useWorkspaceFolders } from '@/lib/workspaces/use-workspace-folders'
import { useWorkspaceTodos } from '@/lib/workspaces/use-workspace-todos'
import { useWorkspaceLinks } from '@/lib/workspaces/use-workspace-links'
import { splitReadings } from '@/lib/workspaces/readings'
import { useStudyProgress } from '@/lib/workspaces/use-study-progress'
import type { StudyProgress } from '@/lib/workspaces/study-progress'
import { formatMinutes } from '@/lib/workspaces/time'
import { ReadingBar } from './ReadingsSection'
import {
  childFolders,
  descendantIds,
  folderCounts,
  folderPath,
  resolveAccent,
  resolveFolderAccent,
  moveTargets,
} from '@/lib/workspaces/folders'
import ConfirmDialog from '../../ConfirmDialog'
import Popover from '../../Popover'
import WorkspacesHelp from './WorkspacesHelp'
import WorkspaceAppearanceMenu from './WorkspaceAppearanceMenu'
import WorkspaceFolderEditor from './WorkspaceFolderEditor'
import WorkspaceFolderTile, { folderDropId } from './WorkspaceFolderTile'
import {
  accentVars,
  actionButtonClass,
  formatDate,
  inputClass,
  microLabelClass,
  primaryButtonClass,
  wsAccentStyle,
} from './shared'

type DragItem = { type: 'folder' | 'workspace'; id: string }
type DropTarget = { type: 'drop'; folderId: string | null }

const gridClass = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'

export default function WorkspacesBoard({ folderId }: { folderId: string | null }) {
  const router = useRouter()
  const {
    workspaces: allWorkspaces,
    loading,
    error,
    createWorkspace,
    updateWorkspace,
    archiveWorkspace,
    unarchiveWorkspace,
    refresh: refreshWorkspaces,
  } = useWorkspaces()
  const {
    folders,
    loading: foldersLoading,
    error: foldersError,
    createFolder,
    updateFolder,
    deleteFolder,
  } = useWorkspaceFolders()
  const studyProgress = useStudyProgress()
  // Module workspaces (with a module code) live on /lectures instead.
  const workspaces = useMemo(() => allWorkspaces.filter((w) => !isModuleWorkspace(w)), [allWorkspaces])
  const moduleCount = allWorkspaces.length - workspaces.length

  const [title, setTitle] = useState('')
  const [view, setView] = useState<'list' | 'cards'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedRowRef = useRef<HTMLButtonElement | null>(null)
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [deletingFolder, setDeletingFolder] = useState<WorkspaceFolder | null>(null)
  const [dragItem, setDragItem] = useState<DragItem | null>(null)
  const [overFolderId, setOverFolderId] = useState<string | null | undefined>(undefined)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  )

  const currentFolder = folderId ? (folders.find((f) => f.id === folderId) ?? null) : null
  const path = useMemo(() => folderPath(folders, folderId), [folders, folderId])
  const subfolders = useMemo(() => childFolders(folders, folderId), [folders, folderId])
  const here = useMemo(
    () => workspaces.filter((w) => (w.folder_id ?? null) === folderId),
    [workspaces, folderId]
  )
  const search = query.trim().toLowerCase()
  const active = here.filter((w) => !w.archived_at && `${w.title} ${w.subtitle ?? ''}`.toLowerCase().includes(search))
  const archived = here.filter((w) => w.archived_at)

  const pageAccent: Accent = resolveFolderAccent(folders, folderId) ?? 'teal'
  const accentOf = (w: Workspace) => resolveAccent(w, folders)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    const created = await createWorkspace(trimmed, folderId)
    setTitle('')
    if (created) router.push(`/workspaces/${created.id}`)
  }

  const handleDeleteFolder = async () => {
    if (!deletingFolder) return
    const target = deletingFolder
    setDeletingFolder(null)
    const ok = await deleteFolder(target.id)
    // The DB moved its workspaces up a level — reload them.
    if (ok) refreshWorkspaces()
    if (ok && target.id === folderId) {
      router.push(target.parent_id ? `/workspaces?folder=${target.parent_id}` : '/workspaces')
    }
  }

  // ---- moving things between folders ----

  const canDrop = (item: DragItem, target: string | null) => {
    if (item.type === 'workspace') {
      const ws = workspaces.find((w) => w.id === item.id)
      return !!ws && (ws.folder_id ?? null) !== target
    }
    const folder = folders.find((f) => f.id === item.id)
    if (!folder || (folder.parent_id ?? null) === target) return false
    return target === null || !descendantIds(folders, item.id).has(target)
  }

  const handleDragStart = ({ active: a }: DragStartEvent) => setDragItem(a.data.current as DragItem)

  const handleDragOver = ({ over }: DragOverEvent) => {
    const target = over?.data.current as DropTarget | undefined
    setOverFolderId(target && dragItem && canDrop(dragItem, target.folderId) ? target.folderId : undefined)
  }

  const handleDragEnd = ({ active: a, over }: DragEndEvent) => {
    setDragItem(null)
    setOverFolderId(undefined)
    const item = a.data.current as DragItem | undefined
    const target = over?.data.current as DropTarget | undefined
    if (!item || !target || !canDrop(item, target.folderId)) return
    if (item.type === 'workspace') updateWorkspace(item.id, { folder_id: target.folderId })
    else updateFolder(item.id, { parent_id: target.folderId })
  }

  const draggedLabel =
    dragItem?.type === 'workspace'
      ? workspaces.find((w) => w.id === dragItem.id)?.title
      : dragItem
        ? folders.find((f) => f.id === dragItem.id)?.name
        : null

  const folderNotFound = !!folderId && !foldersLoading && !currentFolder

  return (
    <main
      className={`${styles.surface} mx-auto flex w-full max-w-360 min-w-0 flex-1 flex-col gap-4 px-4 pt-5 pb-48 sm:px-8`}
      style={accentVars(pageAccent)}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setDragItem(null)
          setOverFolderId(undefined)
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/60 pb-3">
          <div className="flex min-w-0 flex-col gap-2">
            <FolderBreadcrumb path={path} isDragging={!!dragItem} overFolderId={overFolderId} />
            <div className="flex items-center gap-2">
              {currentFolder && <Folder className="h-7 w-7 text-ws-accent" strokeWidth={1.75} aria-hidden />}
              <h1 className="break-words text-2xl font-bold text-on-surface">
                {currentFolder ? currentFolder.name : 'Workspaces'}
              </h1>
              <WorkspacesHelp />
            </div>
            {!currentFolder && moduleCount > 0 && (
              <Link href="/lectures" className="text-xs text-on-surface-variant underline">
                {moduleCount} module {moduleCount === 1 ? 'workspace is' : 'workspaces are'} on Lectures
              </Link>
            )}
          </div>

          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:flex-1 lg:justify-end">
          <label className="min-w-0 flex-1 basis-full sm:basis-auto lg:min-w-48">
            <span className="sr-only">Search workspaces</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles and subtitles..." className={`${inputClass} w-full`} />
          </label>
          <label className="min-[1000px]:hidden">
            <span className="sr-only">Choose folder</span>
            <select value={folderId ?? ''} onChange={(e) => router.push(e.target.value ? `/workspaces?folder=${e.target.value}` : '/workspaces')} className={`${inputClass} min-h-11 max-w-48`}>
              {moveTargets(folders).map((target) => <option key={target.id ?? 'root'} value={target.id ?? ''}>{`${'  '.repeat(target.depth)}${target.label}`}</option>)}
            </select>
          </label>
          <div role="group" aria-label="Workspace view" className="flex rounded-lg border border-outline-variant p-1">
            {(['list', 'cards'] as const).map((option) => <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)} className={`min-h-9 rounded-md px-3 text-sm capitalize ${view === option ? 'bg-ws-accent/15 font-semibold text-ws-accent' : 'text-on-surface-variant'}`}>{option}</button>)}
          </div>
            <Popover
              label="New folder"
              align="end"
              panelClassName="w-80"
              trigger={(props) => (
                <button type="button" {...props} className={actionButtonClass}>
                  <FolderPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                  New folder
                </button>
              )}
            >
              {(close) => (
                <WorkspaceFolderEditor
                  folders={folders}
                  submitLabel={currentFolder ? `Create in ${currentFolder.name}` : 'Create'}
                  onSave={(values) => createFolder(values.name, folderId, values.color)}
                  close={close}
                />
              )}
            </Popover>

            <Popover label="New workspace" align="end" panelClassName="w-80" trigger={(props) => (
              <button type="button" {...props} className={primaryButtonClass}>
                <Plus className="h-3.5 w-3.5" /> New workspace
              </button>
            )}>
              {() => (
                <form onSubmit={handleCreate} className="flex flex-col gap-2">
                  <label htmlFor="new-workspace-name" className="text-sm font-semibold">Workspace name</label>
                  <input id="new-workspace-name" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Coastal Erosion Essay" className={inputClass} />
                  <button type="submit" disabled={!title.trim()} className={primaryButtonClass}>Create workspace</button>
                </form>
              )}
            </Popover>
          </div>
        </div>

        <div className="flex min-w-0 items-start gap-5">
          <nav aria-label="Workspace folders" className="hidden w-48 shrink-0 flex-col gap-1 border-r border-outline-variant/60 pr-3 min-[1000px]:flex">
            <h2 className="px-2 pb-2 text-sm font-semibold">Folders</h2>
            {moveTargets(folders).map((target) => <Link key={target.id ?? 'root'} href={target.id ? `/workspaces?folder=${target.id}` : '/workspaces'} aria-current={(target.id ?? null) === folderId ? 'page' : undefined} style={{ paddingLeft: `${8 + Math.max(0, target.depth - 1) * 12}px` }} className={`flex min-h-11 items-center gap-2 rounded-md pr-2 text-sm ${target.id === folderId ? 'bg-ws-accent/15 font-semibold text-ws-accent' : 'hover:bg-surface-container-high'}`}><Folder className="h-4 w-4 shrink-0" /> <span className="break-words">{target.id ? target.label : 'All workspaces'}</span></Link>)}
          </nav>
          <div className="flex min-w-0 flex-1 flex-col gap-5">
        {(error || foldersError) && (
          <p role="alert" className="text-sm text-error">
            {error || foldersError}
          </p>
        )}

        {folderNotFound ? (
          <p className="text-sm text-on-surface-variant">
            That folder doesn&apos;t exist any more.{' '}
            <Link href="/workspaces" className="underline hover:text-on-surface">
              Back to all workspaces
            </Link>
          </p>
        ) : loading || foldersLoading ? (
          <p className="text-sm text-on-surface-variant">Loading...</p>
        ) : (
          <>
            {subfolders.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className={microLabelClass}>Folders ({subfolders.length})</h2>
                <ul className={view === 'cards' ? gridClass : 'divide-y divide-outline-variant/60'}>
                  {subfolders.map((folder) => (
                    <WorkspaceFolderTile
                      key={folder.id}
                      folder={folder}
                      compact={view === 'list'}
                      folders={folders}
                      accent={resolveFolderAccent(folders, folder.id) ?? 'teal'}
                      counts={folderCounts(folders, workspaces, folder.id)}
                      isDropTarget={overFolderId === folder.id}
                      onSave={(values) =>
                        updateFolder(folder.id, { name: values.name, color: values.color, parent_id: values.parent_id })
                      }
                      onDelete={() => setDeletingFolder(folder)}
                    />
                  ))}
                </ul>
              </section>
            )}

            <section className="flex flex-col gap-3">
              <h2 className={microLabelClass}>Active ({active.length})</h2>
              {active.length === 0 ? (
                <p className="text-sm text-on-surface-variant">
                  {query.trim() ? 'No workspaces match this search.' : currentFolder
                    ? 'No workspaces in this folder yet — create one above, or drag one onto this folder.'
                    : 'No active workspaces here yet — create one to get started.'}
                </p>
              ) : (
                <ul className={view === 'cards' ? gridClass : 'divide-y divide-outline-variant/60'}>
                  {active.map((w) => view === 'list' ? (
                    <WorkspaceRow key={w.id} workspace={w} folders={folders} accent={accentOf(w)} study={studyProgress.get(w.id)} selected={selectedId === w.id} onSelect={(button) => { selectedRowRef.current = button; setSelectedId(w.id) }} onChange={(patch) => updateWorkspace(w.id, patch)} onArchive={() => archiveWorkspace(w.id)} />
                  ) : (
                    <WorkspaceCard
                      key={w.id}
                      workspace={w}
                      folders={folders}
                      accent={accentOf(w)}
                      study={studyProgress.get(w.id)}
                      onChange={(patch) => updateWorkspace(w.id, patch)}
                      onArchive={() => archiveWorkspace(w.id)}
                    />
                  ))}
                </ul>
              )}
            </section>

            {archived.length > 0 && (
              <section className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setShowArchived((v) => !v)}
                  aria-expanded={showArchived}
                  className={`flex w-fit items-center gap-1 ${microLabelClass} hover:text-on-surface`}
                >
                  {showArchived ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  Archived ({archived.length})
                </button>
                {showArchived && (
                  <ul className={gridClass}>
                    {archived.map((w) => (
                      <WorkspaceCard
                        key={w.id}
                        workspace={w}
                        folders={folders}
                        accent={accentOf(w)}
                        onChange={(patch) => updateWorkspace(w.id, patch)}
                        onUnarchive={() => unarchiveWorkspace(w.id)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}

          </div>
          {selectedId && active.some((w) => w.id === selectedId) && <WorkspacePreview workspace={active.find((w) => w.id === selectedId)!} study={studyProgress.get(selectedId)} selectedRowRef={selectedRowRef} onClose={() => setSelectedId(null)} />}
        </div>
        <DragOverlay dropAnimation={null}>
          {draggedLabel ? (
            <div className="flex max-w-72 items-center gap-2 rounded-lg border border-outline bg-surface-container-high px-3 py-2 shadow-lg">
              {dragItem?.type === 'folder' ? (
                <Folder className="h-4 w-4 shrink-0 text-ws-accent" strokeWidth={1.75} />
              ) : (
                <FolderKanban className="h-4 w-4 shrink-0 text-ws-accent" strokeWidth={1.75} />
              )}
              <span className="truncate text-sm font-semibold text-on-surface">{draggedLabel}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <ConfirmDialog
        isOpen={deletingFolder !== null}
        message={`Delete the folder "${deletingFolder?.name}"? Everything inside it moves up one level — no workspaces are deleted.`}
        onCancel={() => setDeletingFolder(null)}
        onConfirm={handleDeleteFolder}
      />
    </main>
  )
}

// "All workspaces › Uni › Year 2" — each step is a link and, while
// something is being dragged, a drop target for moving it up.
function FolderBreadcrumb({
  path,
  isDragging,
  overFolderId,
}: {
  path: WorkspaceFolder[]
  isDragging: boolean
  overFolderId: string | null | undefined
}) {
  if (path.length === 0 && !isDragging) return null
  const steps: { id: string | null; label: string }[] = [
    { id: null, label: 'All workspaces' },
    ...path.map((f) => ({ id: f.id, label: f.name })),
  ]
  return (
    <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 text-xs">
      {steps.map((step, i) => (
        <span key={step.id ?? 'root'} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-on-surface-variant/50" aria-hidden />}
          <DropCrumb
            folderId={step.id}
            label={step.label}
            isCurrent={i === steps.length - 1}
            isDragging={isDragging}
            isOver={overFolderId === step.id}
          />
        </span>
      ))}
    </nav>
  )
}

function DropCrumb({
  folderId,
  label,
  isCurrent,
  isDragging,
  isOver,
}: {
  folderId: string | null
  label: string
  isCurrent: boolean
  isDragging: boolean
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: folderDropId(folderId), data: { type: 'drop', folderId } })
  return (
    <Link
      ref={setNodeRef}
      href={folderId ? `/workspaces?folder=${folderId}` : '/workspaces'}
      aria-current={isCurrent ? 'page' : undefined}
      className={`rounded-md px-1.5 py-0.5 transition-colors ${
        isOver
          ? 'bg-ws-accent/15 text-ws-accent outline-1 outline-ws-accent'
          : isDragging
            ? 'text-on-surface outline-1 outline-dashed outline-outline-variant'
            : isCurrent
              ? 'text-on-surface'
              : 'text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {label}
    </Link>
  )
}

function WorkspaceCard({
  workspace,
  folders,
  accent,
  study,
  onChange,
  onArchive,
  onUnarchive,
}: {
  workspace: Workspace
  folders: WorkspaceFolder[]
  accent: Accent
  study?: StudyProgress
  onChange: (patch: { color?: string | null; folder_id?: string | null }) => void
  onArchive?: () => void
  onUnarchive?: () => void
}) {
  const isArchived = !!workspace.archived_at
  const [menuOpen, setMenuOpen] = useState(false)
  // Study modules (Readings / Study time switched on) show their progress.
  const hidden = workspace.hidden_sections ?? []
  const showReadings = !hidden.includes('readings')
  const showTime = !hidden.includes('time')
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ws:${workspace.id}`,
    data: { type: 'workspace', id: workspace.id },
  })

  return (
    <li
      ref={setNodeRef}
      style={accentVars(accent)}
      className={`${isDragging ? 'opacity-40' : ''} ${menuOpen ? 'relative z-10' : ''}`}
    >
      <ModuleGlassCard style={wsAccentStyle} size="sm" className="flex h-full flex-col gap-2">
        <div className="flex items-start gap-1.5">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Move ${workspace.title}`}
            className="mt-1 shrink-0 touch-none cursor-grab rounded p-0.5 text-on-surface-variant/40 hover:bg-surface-container-high hover:text-on-surface-variant active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <Link href={`/workspaces/${workspace.id}`} className="flex min-w-0 flex-1 items-start gap-2.5">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                isArchived
                  ? 'border-outline-variant bg-surface-container-highest text-on-surface-variant'
                  : 'border-ws-accent/30 bg-ws-accent/10 text-ws-accent'
              }`}
              aria-hidden
            >
              <FolderKanban className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-on-surface">{workspace.title}</span>
              <span className="truncate text-xs text-on-surface-variant">
                {workspace.subtitle || `Created ${formatDate(workspace.created_at)}`}
              </span>
            </span>
          </Link>
          <WorkspaceAppearanceMenu
            workspace={workspace}
            folders={folders}
            onChange={onChange}
            open={menuOpen}
            onOpenChange={setMenuOpen}
          />
        </div>

        {(showReadings || showTime) && !isArchived && (
          <div className="flex flex-col gap-1.5 pt-1">
            {showReadings && (
              <div className="flex items-center gap-2">
                <ReadingBar percent={study?.readings.percent ?? 0} className="h-1.5 flex-1" />
                <span className="shrink-0 text-[11px] tabular-nums text-on-surface-variant">
                  {study?.readings.done ?? 0}/{study?.readings.total ?? 0} read
                </span>
              </div>
            )}
            {showTime && (
              <span className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                <Clock className="h-3 w-3 text-ws-accent" strokeWidth={1.75} aria-hidden />
                <span className="tabular-nums text-on-surface">{formatMinutes(study?.minutesThisWeek ?? 0)}</span>
                this week
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <StatusBadge accent={isArchived ? 'neutral' : 'ws'} size="sm">
            {isArchived ? 'Archived' : 'Active'}
          </StatusBadge>

          {isArchived ? (
            <button type="button" onClick={onUnarchive} className={actionButtonClass}>
              <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={1.75} />
              Unarchive
            </button>
          ) : (
            <button type="button" onClick={onArchive} className={actionButtonClass}>
              <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
              Archive
            </button>
          )}
        </div>
      </ModuleGlassCard>
    </li>
  )
}


function WorkspaceRow({ workspace, folders, accent, study, selected, onSelect, onChange, onArchive }: {
  workspace: Workspace; folders: WorkspaceFolder[]; accent: Accent; study?: StudyProgress; selected: boolean;
  onSelect: (button: HTMLButtonElement) => void; onChange: (patch: { color?: string | null; folder_id?: string | null }) => void; onArchive: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `ws:${workspace.id}`, data: { type: 'workspace', id: workspace.id } })
  const hidden = workspace.hidden_sections ?? []
  return <li ref={setNodeRef} style={accentVars(accent)} className={`flex min-w-0 items-center gap-1 ${selected ? 'bg-ws-accent/10' : ''} ${isDragging ? 'opacity-40' : ''}`}>
    <button type="button" {...attributes} {...listeners} aria-label={`Move ${workspace.title}`} className="hidden min-h-11 w-8 shrink-0 touch-none items-center justify-center text-on-surface-variant sm:flex"><GripVertical className="h-4 w-4" /></button>
    <button type="button" onClick={(event) => onSelect(event.currentTarget)} aria-pressed={selected} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 px-2 text-left">
      <span className="h-3 w-3 shrink-0 rounded-full bg-ws-accent" />
      <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{workspace.title}</span><span className="block text-xs text-on-surface-variant empty:hidden">{[!hidden.includes('readings') && `Readings: ${study?.readings.done ?? 0} / ${study?.readings.total ?? 0}`, !hidden.includes('time') && `${formatMinutes(study?.minutesThisWeek ?? 0)} this week`, workspace.subtitle].filter(Boolean).join(' · ')}</span></span>
    </button>
    <WorkspaceAppearanceMenu workspace={workspace} folders={folders} onChange={onChange} onArchive={onArchive} />
  </li>
}

function WorkspacePreview({ workspace, study, selectedRowRef, onClose }: {
  workspace: Workspace
  study?: StudyProgress
  selectedRowRef: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const media = window.matchMedia('(min-width: 1000px)')
    const updateMode = () => {
      const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (dialog.open) {
        if (typeof dialog.close === 'function') dialog.close()
        else dialog.removeAttribute('open')
      }
      if (media.matches) {
        if (typeof dialog.show === 'function') dialog.show()
        else dialog.setAttribute('open', '')
        // A nonmodal inline preview must not take focus away from the list.
        focused?.focus()
      } else {
        if (typeof dialog.showModal === 'function') dialog.showModal()
        else dialog.setAttribute('open', '')
        dialog.querySelector<HTMLButtonElement>('button')?.focus()
      }
    }
    updateMode()
    media.addEventListener('change', updateMode)
    return () => {
      media.removeEventListener('change', updateMode)
      if (dialog.open && typeof dialog.close === 'function') dialog.close()
      // The selected row can change while the desktop pane stays mounted.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      selectedRowRef.current?.focus()
    }
  }, [selectedRowRef])
  const { todos, loading: todosLoading } = useWorkspaceTodos(workspace.id)
  const { links, loading: linksLoading } = useWorkspaceLinks(workspace.id)
  const { sources } = splitReadings(links)
  const hidden = workspace.hidden_sections ?? []
  return <dialog ref={dialogRef} aria-label={`${workspace.title} preview`} onCancel={(event) => { event.preventDefault(); onClose() }} className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto border-0 bg-surface px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop:bg-black/30 min-[1000px]:static min-[1000px]:h-auto min-[1000px]:w-72 min-[1000px]:shrink-0 min-[1000px]:overflow-visible min-[1000px]:rounded-lg min-[1000px]:border min-[1000px]:border-outline-variant/60 min-[1000px]:p-4">

    <div className="flex items-start justify-between gap-3"><div><h2 className="break-words text-xl font-bold">{workspace.title}</h2><p className="mt-1 text-sm text-on-surface-variant">{[!hidden.includes('readings') && `Readings: ${study?.readings.done ?? 0} / ${study?.readings.total ?? 0}`, !hidden.includes('time') && `${formatMinutes(study?.minutesThisWeek ?? 0)} this week`].filter(Boolean).join(' · ')}</p></div><button type="button" onClick={onClose} className="min-h-11 min-w-11 text-sm">Back</button></div>
    {workspace.subtitle && <p className="mt-3 text-sm text-on-surface-variant">{workspace.subtitle}</p>}
    <Link href={`/workspaces/${workspace.id}`} className={`${primaryButtonClass} mt-4 flex min-h-11 justify-center`}>Open workspace</Link>
    <section className="mt-5 border-t border-outline-variant/60 pt-4"><h3 className="font-semibold">Tasks ({todos.length})</h3>{todosLoading ? <p>Loading...</p> : todos.length ? <ul className="mt-2 space-y-2">{todos.slice(0, 5).map((todo) => <li key={todo.id} className="break-words text-sm">{todo.completed_at ? '✓' : '○'} {todo.title}</li>)}</ul> : <p className="mt-2 text-sm text-on-surface-variant">No scoped tasks yet.</p>}</section>
    <section className="mt-5 border-t border-outline-variant/60 pt-4"><h3 className="font-semibold">Sources ({sources.length})</h3>{linksLoading ? <p>Loading...</p> : sources.length ? <ul className="mt-2 space-y-2">{sources.slice(0, 5).map((link) => <li key={link.id} className="break-words text-sm">{link.title}</li>)}</ul> : <p className="mt-2 text-sm text-on-surface-variant">No sources yet.</p>}</section>
  </dialog>
}
