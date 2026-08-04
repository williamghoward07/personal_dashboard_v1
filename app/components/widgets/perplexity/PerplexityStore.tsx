'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { PerplexityLink } from '@/lib/types'
import WidgetCard from '../../WidgetCard'
import ConfirmDialog from '../../ConfirmDialog'
import PerplexityLinkCard from './PerplexityLinkCard'
import PerplexityLinkFormModal from './PerplexityLinkFormModal'

const DEFAULT_FOLDER = 'Unsorted'

export default function PerplexityStore() {
  const [links, setLinks] = useState<PerplexityLink[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingLink, setEditingLink] = useState<PerplexityLink | null>(null)
  const [deletingLink, setDeletingLink] = useState<PerplexityLink | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const refresh = () => {
    supabase
      .from('perplexity_links')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setLinks(data ?? [])
        setLoading(false)
      })
  }

  useEffect(refresh, [])

  const folders = useMemo(() => {
    const map = new Map<string, PerplexityLink[]>()
    for (const link of links) {
      const key = link.folder || DEFAULT_FOLDER
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(link)
    }
    return Array.from(map.entries())
  }, [links])

  const existingFolders = useMemo(
    () => Array.from(new Set(links.map((l) => l.folder || DEFAULT_FOLDER))),
    [links],
  )

  const handleCopy = async (link: PerplexityLink) => {
    try {
      await navigator.clipboard.writeText(link.url)
      setCopiedId(link.id)
      setTimeout(
        () => setCopiedId((current) => (current === link.id ? null : current)),
        1500,
      )
    } catch {
      // clipboard permission denied — nothing to fall back to
    }
  }

  return (
    <>
      <WidgetCard
        title="Perplexity link store"
        accent="pink"
        className="sm:col-span-2 xl:col-span-4"
        action={
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            aria-label="Add Perplexity link"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-research-pink"
          >
            <Plus className="h-4 w-4" />
          </button>
        }
      >
        {loading ? (
          <p>Loading...</p>
        ) : links.length === 0 ? (
          <p>No saved chats yet — add a link to get started.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {folders.map(([folder, folderLinks]) => (
              <div key={folder} className="flex flex-col gap-2">
                <h3 className="font-display text-xs font-bold tracking-wide text-on-surface-variant uppercase">
                  {folder}
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {folderLinks.map((link) => (
                    <PerplexityLinkCard
                      key={link.id}
                      link={link}
                      copied={copiedId === link.id}
                      onCopy={() => handleCopy(link)}
                      onEdit={() => setEditingLink(link)}
                      onDelete={() => setDeletingLink(link)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </WidgetCard>

      <PerplexityLinkFormModal
        isOpen={isAddOpen}
        heading="New saved chat"
        existingFolders={existingFolders}
        onClose={() => setIsAddOpen(false)}
        onSave={async (url, title, folder) => {
          await supabase
            .from('perplexity_links')
            .insert({ url, title, folder: folder || DEFAULT_FOLDER })
          setIsAddOpen(false)
          refresh()
        }}
      />

      <PerplexityLinkFormModal
        isOpen={editingLink !== null}
        heading="Edit saved chat"
        existingFolders={existingFolders}
        initialUrl={editingLink?.url}
        initialTitle={editingLink?.title}
        initialFolder={editingLink?.folder}
        onClose={() => setEditingLink(null)}
        onSave={async (url, title, folder) => {
          if (!editingLink) return
          await supabase
            .from('perplexity_links')
            .update({ url, title, folder: folder || DEFAULT_FOLDER })
            .eq('id', editingLink.id)
          setEditingLink(null)
          refresh()
        }}
      />

      <ConfirmDialog
        isOpen={deletingLink !== null}
        message={`Delete "${deletingLink?.title || deletingLink?.url}"? This can't be undone.`}
        onCancel={() => setDeletingLink(null)}
        onConfirm={async () => {
          if (!deletingLink) return
          await supabase.from('perplexity_links').delete().eq('id', deletingLink.id)
          setDeletingLink(null)
          refresh()
        }}
      />
    </>
  )
}
