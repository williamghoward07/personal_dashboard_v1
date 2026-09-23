'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronsDownUp, ChevronsUpDown, LayoutGrid, Plus } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { supabase } from '@/lib/supabase'
import type { Accent } from '@/lib/theme'
import { ACCENT_BAR, ACCENT_TEXT } from '@/lib/theme'
import type { LinkFolder, QuickLink } from '@/lib/types'
import {
  applyPatches,
  displayOrder,
  folderKeyOf,
  folderOrderPatches,
  groupLinks,
  linkOrderPatches,
  moveLink,
} from '@/lib/app-launcher/order'
import { resolveLauncherIds, toggleLauncherLink } from '@/lib/app-launcher/launcher-selection'
import { useSettings } from '@/lib/settings/use-settings'
import { useStoredIdSet } from '@/lib/utils/use-stored-id-set'
import ConfirmDialog from '../../ConfirmDialog'
import FolderTile, { folderDragId, type FolderGroup } from './FolderTile'
import LinkFolderFormModal, { type LinkFolderFormValues } from './LinkFolderFormModal'
import QuickLinkFormModal, { type QuickLinkFormValues } from './QuickLinkFormModal'
import DeleteFolderModal, { type DeleteFolderAction } from './DeleteFolderModal'
import FaviconTile from './FaviconTile'
import { UNFILED_FOLDER_ID, resolveFaviconPath, saveRowPatches } from './shared'

const MIGRATION_HINT =
  'Have you run supabase/migrations/20260827000000_link_folders_and_quick_links.sql in the Supabase SQL editor yet?'

const COLLAPSED_STORAGE_KEY = 'app-library:collapsed-folders'

type DragType = 'folder' | 'link'

type LinkPreset = Pick<QuickLink, 'title' | 'url' | 'folder_id' | 'favicon_custom_url' | 'favicon_path'>

const idOf = (dragId: string | number) => String(dragId).replace(/^(folder|link|drop):/, '')
const typeOf = (data: unknown): string | undefined => (data as { type?: string } | undefined)?.type

// Folders only collide with folders; links collide with links first (for
// in-list positioning), then with whole folder tiles (to drop into a
// collapsed or empty folder).
const collisionDetection: CollisionDetection = (args) => {
  const activeType = typeOf(args.active.data.current)
  const droppableContainers = args.droppableContainers.filter((container) => {
    const t = typeOf(container.data.current)
    return activeType === 'folder' ? t === 'folder' : t === 'link' || t === 'folder-drop'
  })
  if (activeType === 'folder') return closestCenter({ ...args, droppableContainers })

  const hits = pointerWithin({ ...args, droppableContainers })
  const linkHits = hits.filter((hit) => String(hit.id).startsWith('link:'))
  if (linkHits.length > 0) return linkHits
  if (hits.length > 0) return hits
  return closestCenter({ ...args, droppableContainers })
}

export default function AppLibraryBoard() {
  const [folders, setFolders] = useState<LinkFolder[]>([])
  const [links, setLinks] = useState<QuickLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsedIds, setCollapsedIds] = useStoredIdSet(COLLAPSED_STORAGE_KEY)
  const { settings, error: settingsError, updateSettings } = useSettings()

  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState<LinkFolder | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<LinkFolder | null>(null)

  // Kept as a state object (not built inline) — QuickLinkFormModal resets
  // its fields whenever initialValues changes identity.
  const [addLinkPreset, setAddLinkPreset] = useState<LinkPreset | null>(null)
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null)
  const [deletingLink, setDeletingLink] = useState<QuickLink | null>(null)

  const [dragType, setDragType] = useState<DragType | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [overFolderKey, setOverFolderKey] = useState<string | null>(null)
  const linksAtDragStart = useRef<QuickLink[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const refresh = () => {
    setLoading(true)
    Promise.all([
      supabase.from('link_folders').select('*').order('sort_order', { ascending: true }),
      supabase.from('quick_links').select('*').order('sort_order', { ascending: true }),
    ]).then(([f, l]) => {
      if (f.error) {
        setError(`Couldn't load folders: ${f.error.message}. ${MIGRATION_HINT}`)
      } else if (l.error) {
        setError(`Couldn't load links: ${l.error.message}. ${MIGRATION_HINT}`)
      } else {
        setError(null)
      }
      setFolders((f.data ?? []) as LinkFolder[])
      setLinks((l.data ?? []) as QuickLink[])
      setLoading(false)
    })
  }

  useEffect(refresh, [])

  const folderIds = useMemo(() => folders.map((f) => f.id), [folders])

  // The launcher's ordered array, resolved against links that still exist —
  // this is the "is a link pinned" answer everywhere on this page now;
  // quick_links.is_pinned is retired and never read (CLAUDE.md App Library).
  const pinnedIds = useMemo(() => {
    const availableIds = new Set(links.map((l) => l.id))
    return new Set(resolveLauncherIds(settings.launcher_link_ids, availableIds))
  }, [settings.launcher_link_ids, links])

  const folderGroups = useMemo<FolderGroup[]>(() => {
    const byFolder = groupLinks(links)
    const real: FolderGroup[] = folders.map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color as Accent,
      isVirtual: false,
      links: byFolder.get(f.id) ?? [],
    }))

    const unfiledLinks = byFolder.get(UNFILED_FOLDER_ID) ?? []
    // Unfiled always shows while a link is being dragged, so a link can be
    // taken out of every folder.
    if (unfiledLinks.length === 0 && dragType !== 'link') return real

    return [...real, { id: UNFILED_FOLDER_ID, name: 'Unfiled', color: 'neutral', isVirtual: true, links: unfiledLinks }]
  }, [folders, links, dragType])

  const allCollapsed = folderGroups.length > 0 && folderGroups.every((g) => collapsedIds.has(g.id))

  const toggleExpanded = (id: string) => {
    const next = new Set(collapsedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setCollapsedIds(next)
  }

  const runMutation = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error: mutationError } = await fn()
    if (mutationError) {
      setError(`Couldn't save: ${mutationError.message}. ${MIGRATION_HINT}`)
      return false
    }
    setError(null)
    return true
  }

  const handleAddFolder = async (values: LinkFolderFormValues) => {
    const maxSort = folders.reduce((m, f) => Math.max(m, f.sort_order), -1)
    const ok = await runMutation(() => supabase.from('link_folders').insert({ ...values, sort_order: maxSort + 1 }))
    if (ok) {
      setIsAddFolderOpen(false)
      refresh()
    }
  }

  const handleEditFolder = async (values: LinkFolderFormValues) => {
    if (!editingFolder) return
    const ok = await runMutation(() => supabase.from('link_folders').update(values).eq('id', editingFolder.id))
    if (ok) {
      setEditingFolder(null)
      refresh()
    }
  }

  const handleDeleteEmptyFolder = async () => {
    if (!deletingFolder) return
    const folderId = deletingFolder.id
    const ok = await runMutation(() => supabase.from('link_folders').delete().eq('id', folderId))
    if (ok) {
      setDeletingFolder(null)
      refresh()
    }
  }

  const handleDeleteFolderWithLinks = async (action: DeleteFolderAction) => {
    if (!deletingFolder) return
    const folderId = deletingFolder.id
    const ok = await runMutation(async () => {
      const { error: reassignError } = await supabase
        .from('quick_links')
        .update(action.type === 'reassign' ? { folder_id: action.targetFolderId } : { folder_id: null })
        .eq('folder_id', folderId)
      if (reassignError) return { error: reassignError }
      return supabase.from('link_folders').delete().eq('id', folderId)
    })
    if (ok) {
      setDeletingFolder(null)
      refresh()
    }
  }

  const openAddLink = (folderId: string | null) =>
    setAddLinkPreset({
      title: '',
      url: '',
      folder_id: folderId,
      favicon_custom_url: null,
      favicon_path: null,
    })

  const handleAddLink = async (values: QuickLinkFormValues) => {
    const faviconPath = await resolveFaviconPath(values.url)
    const maxSort = links.reduce((m, l) => Math.max(m, l.sort_order), -1)
    const ok = await runMutation(() =>
      supabase.from('quick_links').insert({ ...values, favicon_path: faviconPath, sort_order: maxSort + 1 }),
    )
    if (ok) {
      setAddLinkPreset(null)
      if (values.folder_id && collapsedIds.has(values.folder_id)) toggleExpanded(values.folder_id)
      refresh()
    }
  }

  const handleEditLink = async (values: QuickLinkFormValues) => {
    if (!editingLink) return
    const urlChanged = values.url !== editingLink.url
    const faviconPath = urlChanged ? await resolveFaviconPath(values.url) : editingLink.favicon_path
    const ok = await runMutation(() =>
      supabase.from('quick_links').update({ ...values, favicon_path: faviconPath }).eq('id', editingLink.id),
    )
    if (ok) {
      setEditingLink(null)
      refresh()
    }
  }

  const handleTogglePinLink = async (link: QuickLink) => {
    await updateSettings({ launcher_link_ids: toggleLauncherLink([...pinnedIds], link.id) })
  }

  // ---- drag and drop ----

  const endDrag = () => {
    setDragType(null)
    setActiveDragId(null)
    setOverFolderKey(null)
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    const type = typeOf(active.data.current)
    setDragType(type === 'folder' ? 'folder' : 'link')
    setActiveDragId(idOf(active.id))
    linksAtDragStart.current = links
  }

  // Moving a link into another folder happens while hovering, so the
  // target list opens up a gap for it; ordering within a list is left to
  // dnd-kit's sortable preview until the drop.
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (typeOf(active.data.current) !== 'link' || !over) {
      setOverFolderKey(null)
      return
    }
    const activeId = idOf(active.id)
    const overType = typeOf(over.data.current)
    const overLink = overType === 'link' ? links.find((l) => l.id === idOf(over.id)) : undefined
    const targetKey = overLink
      ? folderKeyOf(overLink)
      : overType === 'folder-drop'
        ? (over.data.current as { folderKey: string }).folderKey
        : null
    setOverFolderKey(targetKey)
    if (!targetKey) return

    const activeLink = links.find((l) => l.id === activeId)
    if (!activeLink || folderKeyOf(activeLink) === targetKey) return
    const targetFolderId = targetKey === UNFILED_FOLDER_ID ? null : targetKey
    setLinks((prev) => moveLink(prev, activeId, targetFolderId, overLink?.id ?? null))
  }

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    const type = typeOf(active.data.current)
    endDrag()
    if (!over) {
      if (type === 'link') setLinks(linksAtDragStart.current)
      return
    }

    if (type === 'folder') {
      const from = folders.findIndex((f) => f.id === idOf(active.id))
      const to = folders.findIndex((f) => f.id === idOf(over.id))
      if (from === -1 || to === -1 || from === to) return
      const patches = folderOrderPatches(arrayMove(folders, from, to))
      const previous = folders
      setFolders(applyPatches(arrayMove(folders, from, to), patches))
      const { error: saveError } = await saveRowPatches('link_folders', patches)
      if (saveError) {
        setError(`Couldn't save the new folder order: ${saveError.message}`)
        setFolders(previous)
      }
      return
    }

    const activeId = idOf(active.id)
    const activeLink = links.find((l) => l.id === activeId)
    if (!activeLink) return
    let next = links
    if (typeOf(over.data.current) === 'link' && idOf(over.id) !== activeId) {
      next = moveLink(links, activeId, activeLink.folder_id, idOf(over.id))
    }

    const ordered = displayOrder(next, folderIds)
    const patches = linkOrderPatches(ordered, linksAtDragStart.current)
    if (patches.length === 0) {
      setLinks(linksAtDragStart.current)
      return
    }
    setLinks(applyPatches(ordered, patches))
    const { error: saveError } = await saveRowPatches('quick_links', patches)
    if (saveError) {
      setError(`Couldn't save the new link order: ${saveError.message}`)
      refresh()
    }
  }

  const handleDragCancel = () => {
    if (dragType === 'link') setLinks(linksAtDragStart.current)
    endDrag()
  }

  const draggedLink = dragType === 'link' ? links.find((l) => l.id === activeDragId) : undefined
  const draggedFolder = dragType === 'folder' ? folders.find((f) => f.id === activeDragId) : undefined

  const linksInDeletingFolder = deletingFolder ? links.filter((l) => l.folder_id === deletingFolder.id) : []
  const otherFoldersForReassign = deletingFolder ? folders.filter((f) => f.id !== deletingFolder.id) : []
  const presetFolderName = addLinkPreset?.folder_id
    ? folders.find((f) => f.id === addLinkPreset.folder_id)?.name
    : null

  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`flex items-center gap-2 font-display text-headline-lg font-bold ${ACCENT_TEXT.neutral}`}>
            <LayoutGrid className="h-6 w-6" />
            App Library
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Your pinned and filed apps and links, in one place. Use + on a folder to add a link to it, and drag the
            grips to reorder.
          </p>
        </div>
        <div className="flex gap-2">
          {folderGroups.length > 0 && (
            <button
              type="button"
              onClick={() => setCollapsedIds(allCollapsed ? new Set() : new Set(folderGroups.map((g) => g.id)))}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            >
              {allCollapsed ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsAddFolderOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-outline px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Add folder
          </button>
        </div>
      </div>

      {(error || settingsError) && (
        <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
          {error ?? settingsError}
        </div>
      )}

      {loading && links.length === 0 && folders.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Loading...</p>
      ) : folderGroups.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-on-surface-variant">
            No apps yet — add a link to get started, and a folder whenever you want to organize them.
          </p>
          <button
            type="button"
            onClick={() => openAddLink(null)}
            className="flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Plus className="h-4 w-4" />
            Add link
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={folders.map((f) => folderDragId(f.id))} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {folderGroups.map((group) => (
                <FolderTile
                  key={group.id}
                  folder={group}
                  isExpanded={!collapsedIds.has(group.id)}
                  isLinkDropTarget={dragType === 'link' && overFolderKey === group.id}
                  pinnedIds={pinnedIds}
                  onToggleExpand={() => toggleExpanded(group.id)}
                  onAddLink={() => openAddLink(group.isVirtual ? null : group.id)}
                  onEdit={() => {
                    const real = folders.find((f) => f.id === group.id)
                    if (real) setEditingFolder(real)
                  }}
                  onDelete={() => {
                    const real = folders.find((f) => f.id === group.id)
                    if (real) setDeletingFolder(real)
                  }}
                  onEditLink={(link) => setEditingLink(link)}
                  onDeleteLink={(link) => setDeletingLink(link)}
                  onTogglePinLink={handleTogglePinLink}
                />
              ))}
            </div>
          </SortableContext>

          {/* A floating preview — the dragged link's own row can unmount
              mid-drag when it moves into a collapsed folder. */}
          <DragOverlay dropAnimation={null}>
            {draggedLink ? (
              <div className="flex max-w-72 items-center gap-2 rounded-lg border border-outline bg-surface-container-high p-1.5 shadow-2xl shadow-black/50">
                <FaviconTile
                  title={draggedLink.title}
                  url={draggedLink.url}
                  faviconPath={draggedLink.favicon_path}
                  faviconCustomUrl={draggedLink.favicon_custom_url}
                  size="sm"
                />
                <span className="truncate text-sm text-on-surface">{draggedLink.title}</span>
              </div>
            ) : draggedFolder ? (
              <div className="flex max-w-72 items-center gap-2 rounded-lg border border-outline bg-surface-container-high px-3 py-2 shadow-2xl shadow-black/50">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ACCENT_BAR[draggedFolder.color as Accent]}`} />
                <span className="truncate text-sm font-semibold text-on-surface">{draggedFolder.name}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <LinkFolderFormModal
        isOpen={isAddFolderOpen}
        heading="New folder"
        onClose={() => setIsAddFolderOpen(false)}
        onSave={handleAddFolder}
      />

      <LinkFolderFormModal
        isOpen={editingFolder !== null}
        heading="Edit folder"
        initialValues={editingFolder}
        onClose={() => setEditingFolder(null)}
        onSave={handleEditFolder}
      />

      <QuickLinkFormModal
        isOpen={addLinkPreset !== null}
        heading={presetFolderName ? `New link in ${presetFolderName}` : 'New link'}
        folders={folders}
        initialValues={addLinkPreset}
        onClose={() => setAddLinkPreset(null)}
        onSave={handleAddLink}
      />

      <QuickLinkFormModal
        isOpen={editingLink !== null}
        heading="Edit link"
        folders={folders}
        initialValues={editingLink}
        onClose={() => setEditingLink(null)}
        onSave={handleEditLink}
      />

      {deletingFolder && linksInDeletingFolder.length === 0 ? (
        <ConfirmDialog
          isOpen={deletingFolder !== null}
          message={`Delete "${deletingFolder?.name}"? This can't be undone.`}
          onCancel={() => setDeletingFolder(null)}
          onConfirm={handleDeleteEmptyFolder}
        />
      ) : (
        <DeleteFolderModal
          folder={deletingFolder}
          linkCount={linksInDeletingFolder.length}
          otherFolders={otherFoldersForReassign}
          onCancel={() => setDeletingFolder(null)}
          onConfirm={handleDeleteFolderWithLinks}
        />
      )}

      <ConfirmDialog
        isOpen={deletingLink !== null}
        message={`Delete "${deletingLink?.title}"? This can't be undone.`}
        onCancel={() => setDeletingLink(null)}
        onConfirm={async () => {
          if (!deletingLink) return
          const ok = await runMutation(() => supabase.from('quick_links').delete().eq('id', deletingLink.id))
          if (ok) {
            setDeletingLink(null)
            refresh()
          }
        }}
      />
    </main>
  )
}
