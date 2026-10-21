'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArchiveRestore, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, LayoutGrid, Plus, Trash2 } from 'lucide-react'
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
  // Kept apart from folders/links so drag-and-drop and renumbering only
  // ever see active rows. A link inside an archived folder counts as
  // archived (it lives in archivedLinks) whatever its own archived_at.
  const [archivedFolders, setArchivedFolders] = useState<LinkFolder[]>([])
  const [archivedLinks, setArchivedLinks] = useState<QuickLink[]>([])
  const [showArchived, setShowArchived] = useState(false)
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
      const allFolders = (f.data ?? []) as LinkFolder[]
      const allLinks = (l.data ?? []) as QuickLink[]
      const archivedFolderIds = new Set(allFolders.filter((x) => x.archived_at).map((x) => x.id))
      const isArchived = (link: QuickLink) =>
        // Truthy, not `!== null`: archived_at is undefined until
        // 20261009000000 is applied, and that must not archive every link.
        !!link.archived_at || (link.folder_id !== null && archivedFolderIds.has(link.folder_id))
      setFolders(allFolders.filter((x) => !x.archived_at))
      setArchivedFolders(allFolders.filter((x) => x.archived_at))
      setLinks(allLinks.filter((x) => !isArchived(x)))
      setArchivedLinks(allLinks.filter(isArchived))
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

  // Archive moves the row between the active and archived lists straight
  // away; a failed save reloads, which puts it back.
  const setLinkArchived = async (link: QuickLink, archived: boolean) => {
    const archivedAt = archived ? new Date().toISOString() : null
    // Unarchived links go to the end of their folder (sort_order is global).
    const sortOrder = archived ? link.sort_order : links.reduce((m, l) => Math.max(m, l.sort_order), -1) + 1
    const next = { ...link, archived_at: archivedAt, sort_order: sortOrder }
    if (archived) {
      setLinks((prev) => prev.filter((l) => l.id !== link.id))
      setArchivedLinks((prev) => [...prev, next])
    } else {
      setArchivedLinks((prev) => prev.filter((l) => l.id !== link.id))
      setLinks((prev) => [...prev, next])
    }
    const ok = await runMutation(() =>
      supabase.from('quick_links').update({ archived_at: archivedAt, sort_order: sortOrder }).eq('id', link.id),
    )
    if (!ok) refresh()
  }

  const setFolderArchived = async (folder: LinkFolder, archived: boolean) => {
    const archivedAt = archived ? new Date().toISOString() : null
    const next = { ...folder, archived_at: archivedAt }
    if (archived) {
      const moving = links.filter((l) => l.folder_id === folder.id)
      setFolders((prev) => prev.filter((f) => f.id !== folder.id))
      setArchivedFolders((prev) => [...prev, next])
      setLinks((prev) => prev.filter((l) => l.folder_id !== folder.id))
      setArchivedLinks((prev) => [...prev, ...moving])
    } else {
      // Only the links that weren't archived on their own come back.
      const returning = archivedLinks.filter((l) => l.folder_id === folder.id && !l.archived_at)
      setArchivedFolders((prev) => prev.filter((f) => f.id !== folder.id))
      setFolders((prev) => [...prev, next].sort((a, b) => a.sort_order - b.sort_order))
      setArchivedLinks((prev) => prev.filter((l) => !returning.includes(l)))
      setLinks((prev) => [...prev, ...returning].sort((a, b) => a.sort_order - b.sort_order))
    }
    const ok = await runMutation(() =>
      supabase.from('link_folders').update({ archived_at: archivedAt }).eq('id', folder.id),
    )
    if (!ok) refresh()
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

  // Archived links whose folder is still active (or unfiled) are listed one
  // by one; links in an archived folder come back with the folder.
  const archivedFolderIds = new Set(archivedFolders.map((f) => f.id))
  const looseArchivedLinks = archivedLinks.filter((l) => !l.folder_id || !archivedFolderIds.has(l.folder_id))

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
                  onArchive={() => {
                    const real = folders.find((f) => f.id === group.id)
                    if (real) setFolderArchived(real, true)
                  }}
                  onArchiveLink={(link) => setLinkArchived(link, true)}
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

      {(archivedFolders.length > 0 || archivedLinks.length > 0) && (
        <section className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="flex items-center gap-1.5 self-start text-sm text-on-surface-variant hover:text-on-surface"
          >
            {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Archived ({archivedFolders.length + looseArchivedLinks.length})
          </button>
          {showArchived && (
            <div className="flex flex-col gap-1 rounded-lg border border-outline-variant/60 bg-surface-container-low/60 p-2">
              {archivedFolders.map((folder) => {
                const count = archivedLinks.filter((l) => l.folder_id === folder.id).length
                return (
                  <div key={folder.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 opacity-70 hover:opacity-100">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ACCENT_BAR[folder.color as Accent]}`} />
                    <span className="flex-1 truncate text-sm text-on-surface">
                      {folder.name}
                      <span className="ml-2 text-xs text-on-surface-variant">
                        folder · {count} link{count === 1 ? '' : 's'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFolderArchived(folder, false)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" />
                      Unarchive
                    </button>
                  </div>
                )
              })}
              {looseArchivedLinks.map((link) => (
                <div key={link.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 opacity-70 hover:opacity-100">
                  <FaviconTile
                    title={link.title}
                    url={link.url}
                    faviconPath={link.favicon_path}
                    faviconCustomUrl={link.favicon_custom_url}
                    size="sm"
                  />
                  <span className="flex-1 truncate text-sm text-on-surface">
                    {link.title}
                    {link.folder_id && (
                      <span className="ml-2 text-xs text-on-surface-variant">
                        {folders.find((f) => f.id === link.folder_id)?.name}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLinkArchived(link, false)}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" />
                    Unarchive
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingLink(link)}
                    aria-label={`Delete ${link.title}`}
                    className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
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
        existingLinks={[...links, ...archivedLinks]}
        onClose={() => setAddLinkPreset(null)}
        onSave={handleAddLink}
      />

      <QuickLinkFormModal
        isOpen={editingLink !== null}
        heading="Edit link"
        folders={folders}
        initialValues={editingLink}
        existingLinks={[...links, ...archivedLinks].filter((l) => l.id !== editingLink?.id)}
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
