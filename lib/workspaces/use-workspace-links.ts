'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { WorkspaceLink } from '@/lib/types'
import { domainOf, resolveFaviconPath } from './favicon'
import { detectLinkKind } from './kinds'

export type WorkspaceLinkPatch = Partial<
  Pick<WorkspaceLink, 'title' | 'kind' | 'citation' | 'doi' | 'meta_label'>
>

export interface UseWorkspaceLinksResult {
  links: WorkspaceLink[]
  loading: boolean
  error: string | null
  refresh: () => void
  addLink: (rawUrl: string) => Promise<WorkspaceLink | null>
  updateLink: (id: string, patch: WorkspaceLinkPatch) => Promise<void>
  deleteLink: (id: string) => Promise<void>
  reorderLinks: (orderedIds: string[]) => Promise<void>
}

function normalizeUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed).toString()
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString()
    } catch {
      return null
    }
  }
}

// Links for one workspace's grid. addLink() is the single entry point for
// both the inline "+" input and the drop-a-URL handler — see LinksGrid.
export function useWorkspaceLinks(workspaceId: string): UseWorkspaceLinksResult {
  const [links, setLinks] = useState<WorkspaceLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    supabase
      .from('workspace_links')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('position', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setError(null)
          setLinks((data ?? []) as WorkspaceLink[])
        }
        setLoading(false)
      })
  }, [workspaceId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addLink = useCallback(
    async (rawUrl: string) => {
      const url = normalizeUrl(rawUrl)
      if (!url) {
        setError('Not a valid URL')
        return null
      }

      const title = domainOf(url)
      const position = links.length
      const kind = detectLinkKind(url)
      const optimisticId = `optimistic-${crypto.randomUUID()}`
      const optimisticLink: WorkspaceLink = {
        id: optimisticId,
        workspace_id: workspaceId,
        title,
        url,
        favicon_path: null,
        position,
        kind,
        citation: null,
        doi: null,
        meta_label: null,
        created_at: new Date().toISOString(),
      }
      setLinks((prev) => [...prev, optimisticLink])
      setError(null)

      const { data, error: insertError } = await supabase
        .from('workspace_links')
        .insert({ workspace_id: workspaceId, title, url, position, kind })
        .select()
        .single()

      if (insertError || !data) {
        setLinks((prev) => prev.filter((l) => l.id !== optimisticId))
        setError(insertError?.message ?? 'Failed to add link')
        return null
      }

      const created = data as WorkspaceLink
      setLinks((prev) => prev.map((l) => (l.id === optimisticId ? created : l)))

      // Fire-and-forget: the card is already visible with a fallback
      // tile. A failure here is silent — purely decorative, matching
      // app-launcher's openQuickLink last_opened_at update.
      resolveFaviconPath(url).then((path) => {
        if (!path) return
        supabase
          .from('workspace_links')
          .update({ favicon_path: path })
          .eq('id', created.id)
          .then(({ error: patchError }) => {
            if (patchError) {
              console.error('[workspaces] favicon patch failed:', patchError.message)
              return
            }
            setLinks((prev) => prev.map((l) => (l.id === created.id ? { ...l, favicon_path: path } : l)))
          })
      })

      return created
    },
    [links, workspaceId]
  )

  const updateLink = useCallback(
    async (id: string, patch: WorkspaceLinkPatch) => {
      const target = links.find((l) => l.id === id)
      if (!target) return

      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
      setError(null)

      const { error: updateError } = await supabase.from('workspace_links').update(patch).eq('id', id)

      if (updateError) {
        setLinks((prev) => prev.map((l) => (l.id === id ? target : l)))
        setError(updateError.message)
      }
    },
    [links]
  )

  const deleteLink = useCallback(
    async (id: string) => {
      const index = links.findIndex((l) => l.id === id)
      if (index === -1) return
      const target = links[index]

      setLinks((prev) => prev.filter((l) => l.id !== id))
      setError(null)

      const { error: deleteError } = await supabase.from('workspace_links').delete().eq('id', id)

      if (deleteError) {
        setLinks((prev) => {
          const next = [...prev]
          next.splice(index, 0, target)
          return next
        })
        setError(deleteError.message)
      }
    },
    [links]
  )

  const reorderLinks = useCallback(
    async (orderedIds: string[]) => {
      const previous = links
      const reordered = orderedIds
        .map((id, index) => {
          const link = links.find((l) => l.id === id)
          return link ? { ...link, position: index } : null
        })
        .filter((l): l is WorkspaceLink => l !== null)

      setLinks(reordered)
      setError(null)

      const results = await Promise.all(
        reordered.map((l) => supabase.from('workspace_links').update({ position: l.position }).eq('id', l.id))
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) {
        setLinks(previous)
        setError(failed.error.message)
      }
    },
    [links]
  )

  return { links, loading, error, refresh, addLink, updateLink, deleteLink, reorderLinks }
}
