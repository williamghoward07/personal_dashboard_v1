'use client'

import { useEffect, useMemo, useState } from 'react'
import { LayoutGrid, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Accent } from '@/lib/theme'
import { ACCENT_TEXT } from '@/lib/theme'
import type { LinkFolder, QuickLink } from '@/lib/types'
import ConfirmDialog from '../../ConfirmDialog'
import FolderTile, { type FolderGroup } from './FolderTile'
import LinkFolderFormModal, { type LinkFolderFormValues } from './LinkFolderFormModal'
import QuickLinkFormModal, { type QuickLinkFormValues } from './QuickLinkFormModal'
import DeleteFolderModal, { type DeleteFolderAction } from './DeleteFolderModal'
import { UNFILED_FOLDER_ID, resolveFaviconPath, swapSortOrder } from './shared'

const MIGRATION_HINT =
  'Have you run supabase/migrations/20260827000000_link_folders_and_quick_links.sql in the Supabase SQL editor yet?'

export default function AppLibraryBoard() {
  const [folders, setFolders] = useState<LinkFolder[]>([])
  const [links, setLinks] = useState<QuickLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null)

  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState<LinkFolder | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<LinkFolder | null>(null)

  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false)
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null)
  const [deletingLink, setDeletingLink] = useState<QuickLink | null>(null)

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

  const folderGroups = useMemo<FolderGroup[]>(() => {
    const byFolder = new Map<string, QuickLink[]>()
    for (const link of links) {
      const key = link.folder_id ?? UNFILED_FOLDER_ID
      if (!byFolder.has(key)) byFolder.set(key, [])
      byFolder.get(key)!.push(link)
    }

    const real: FolderGroup[] = folders.map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color as Accent,
      isVirtual: false,
      links: byFolder.get(f.id) ?? [],
    }))

    const unfiledLinks = byFolder.get(UNFILED_FOLDER_ID) ?? []
    if (unfiledLinks.length === 0) return real

    return [...real, { id: UNFILED_FOLDER_ID, name: 'Unfiled', color: 'neutral', isVirtual: true, links: unfiledLinks }]
  }, [folders, links])

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
      setExpandedFolderId((id) => (id === folderId ? null : id))
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
      setExpandedFolderId((id) => (id === folderId ? null : id))
      refresh()
    }
  }

  const handleAddLink = async (values: QuickLinkFormValues) => {
    const faviconPath = await resolveFaviconPath(values.url)
    const maxSort = links.reduce((m, l) => Math.max(m, l.sort_order), -1)
    const ok = await runMutation(() =>
      supabase.from('quick_links').insert({ ...values, favicon_path: faviconPath, sort_order: maxSort + 1 }),
    )
    if (ok) {
      setIsAddLinkOpen(false)
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
    const ok = await runMutation(() =>
      supabase.from('quick_links').update({ is_pinned: !link.is_pinned }).eq('id', link.id),
    )
    if (ok) refresh()
  }

  const handleMoveLink = async (folderLinks: QuickLink[], link: QuickLink, direction: 'up' | 'down') => {
    const index = folderLinks.findIndex((l) => l.id === link.id)
    if (index === -1) return
    const { error: reorderError } = await swapSortOrder('quick_links', folderLinks, index, direction)
    if (reorderError) setError(`Couldn't reorder: ${reorderError.message}`)
    refresh()
  }

  const handleMoveFolder = async (folder: LinkFolder, direction: 'up' | 'down') => {
    const index = folders.findIndex((f) => f.id === folder.id)
    if (index === -1) return
    const { error: reorderError } = await swapSortOrder('link_folders', folders, index, direction)
    if (reorderError) setError(`Couldn't reorder: ${reorderError.message}`)
    refresh()
  }

  const linksInDeletingFolder = deletingFolder ? links.filter((l) => l.folder_id === deletingFolder.id) : []
  const otherFoldersForReassign = deletingFolder ? folders.filter((f) => f.id !== deletingFolder.id) : []

  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`flex items-center gap-2 font-display text-headline-lg font-bold ${ACCENT_TEXT.neutral}`}>
            <LayoutGrid className="h-6 w-6" />
            App Library
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Your pinned and filed apps and links, in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsAddFolderOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Plus className="h-4 w-4" />
            Add folder
          </button>
          <button
            type="button"
            onClick={() => setIsAddLinkOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-outline px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Add link
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading...</p>
      ) : folderGroups.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          No apps yet — add a link to get started, and a folder whenever you want to organize them.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {folderGroups.map((group, index) => (
            <FolderTile
              key={group.id}
              folder={group}
              isExpanded={expandedFolderId === group.id}
              onToggleExpand={() => setExpandedFolderId((id) => (id === group.id ? null : group.id))}
              onEdit={() => {
                const real = folders.find((f) => f.id === group.id)
                if (real) setEditingFolder(real)
              }}
              onDelete={() => {
                const real = folders.find((f) => f.id === group.id)
                if (real) setDeletingFolder(real)
              }}
              canMoveUp={!group.isVirtual && index > 0}
              canMoveDown={!group.isVirtual && index < folders.length - 1}
              onMoveUp={() => {
                const real = folders.find((f) => f.id === group.id)
                if (real) handleMoveFolder(real, 'up')
              }}
              onMoveDown={() => {
                const real = folders.find((f) => f.id === group.id)
                if (real) handleMoveFolder(real, 'down')
              }}
              onEditLink={(link) => setEditingLink(link)}
              onDeleteLink={(link) => setDeletingLink(link)}
              onTogglePinLink={handleTogglePinLink}
              onMoveLinkUp={(link) => handleMoveLink(group.links, link, 'up')}
              onMoveLinkDown={(link) => handleMoveLink(group.links, link, 'down')}
            />
          ))}
        </div>
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
        isOpen={isAddLinkOpen}
        heading="New link"
        folders={folders}
        onClose={() => setIsAddLinkOpen(false)}
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
