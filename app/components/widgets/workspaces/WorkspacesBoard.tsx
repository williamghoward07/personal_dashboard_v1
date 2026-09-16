'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
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
import type { Accent } from '@/lib/theme'
import type { Workspace, WorkspaceFolder } from '@/lib/types'
import { useWorkspaces } from '@/lib/workspaces/use-workspaces'
import { useWorkspaceFolders } from '@/lib/workspaces/use-workspace-folders'
import {
  childFolders,
  descendantIds,
  folderCounts,
  folderPath,
  resolveAccent,
  resolveFolderAccent,
} from '@/lib/workspaces/folders'
import ConfirmDialog from '../../ConfirmDialog'
import Popover from '../../Popover'
import WorkspaceHeaderStrip from './WorkspaceHeaderStrip'
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
    workspaces,
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

  const [title, setTitle] = useState('')
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
  const active = here.filter((w) => !w.archived_at)
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
      className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 pt-6 pb-48"
      style={accentVars(pageAccent)}
    >
      <WorkspaceHeaderStrip
        context={currentFolder ? currentFolder.name : 'All Contexts'}
        crumbs={path.slice(0, -1).map((f) => ({ label: f.name, href: `/workspaces?folder=${f.id}` }))}
      />

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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <FolderBreadcrumb path={path} isDragging={!!dragItem} overFolderId={overFolderId} />
            <div className="flex items-center gap-2">
              {currentFolder && <Folder className="h-7 w-7 text-ws-accent" strokeWidth={1.75} aria-hidden />}
              <h1 className="font-display text-headline-lg font-bold text-ws-accent">
                {currentFolder ? currentFolder.name : 'Workspaces'}
              </h1>
              <WorkspacesHelp />
            </div>
            <p className="text-sm text-on-surface-variant">
              {currentFolder
                ? 'Folders and workspaces filed here. Drag a grip onto a folder or a breadcrumb step to move it.'
                : 'An ad hoc container per project — its sources, its scoped actions, and a dated log of your thinking.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

            <form onSubmit={handleCreate} className="flex items-center gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Coastal Erosion Essay"
                aria-label="New workspace name"
                className={`${inputClass} w-64`}
              />
              <button type="submit" disabled={!title.trim()} className={primaryButtonClass}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                New workspace
              </button>
            </form>
          </div>
        </div>

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
                <ul className={gridClass}>
                  {subfolders.map((folder) => (
                    <WorkspaceFolderTile
                      key={folder.id}
                      folder={folder}
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
                  {currentFolder
                    ? 'No workspaces in this folder yet — create one above, or drag one onto this folder.'
                    : 'No active workspaces here yet — create one to get started.'}
                </p>
              ) : (
                <ul className={gridClass}>
                  {active.map((w) => (
                    <WorkspaceCard
                      key={w.id}
                      workspace={w}
                      folders={folders}
                      accent={accentOf(w)}
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

        <DragOverlay dropAnimation={null}>
          {draggedLabel ? (
            <div className="flex max-w-72 items-center gap-2 rounded-lg border border-outline bg-surface-container-high px-3 py-2 shadow-2xl shadow-black/50">
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
  onChange,
  onArchive,
  onUnarchive,
}: {
  workspace: Workspace
  folders: WorkspaceFolder[]
  accent: Accent
  onChange: (patch: { color?: string | null; folder_id?: string | null }) => void
  onArchive?: () => void
  onUnarchive?: () => void
}) {
  const isArchived = !!workspace.archived_at
  const [menuOpen, setMenuOpen] = useState(false)
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

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              isArchived
                ? 'border-outline-variant bg-surface-container-highest text-on-surface-variant'
                : 'border-ws-accent/30 bg-ws-accent/10 text-ws-accent'
            }`}
          >
            {isArchived ? 'Archived' : 'Active'}
          </span>

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
