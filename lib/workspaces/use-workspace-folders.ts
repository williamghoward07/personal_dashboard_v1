'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { WorkspaceFolder } from '@/lib/types'

export type WorkspaceFolderPatch = Partial<Pick<WorkspaceFolder, 'name' | 'color' | 'parent_id'>>

export interface UseWorkspaceFoldersResult {
  folders: WorkspaceFolder[]
  loading: boolean
  error: string | null
  refresh: () => void
  createFolder: (name: string, parentId: string | null, color: string | null) => Promise<WorkspaceFolder | null>
  updateFolder: (id: string, patch: WorkspaceFolderPatch) => Promise<boolean>
  // Contents (subfolders + workspaces) move up one level — done by a DB
  // trigger, so callers should refresh their workspaces afterwards.
  deleteFolder: (id: string) => Promise<boolean>
}

// The DB rejects moving a folder inside itself; its trigger message is
// already written for people, so it's shown as-is.
function friendly(message: string): string {
  return message.includes('folder cannot') ? message.replace(/^.*?(A folder cannot)/, '$1') : message
}

export function useWorkspaceFolders(): UseWorkspaceFoldersResult {
  const [folders, setFolders] = useState<WorkspaceFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    supabase
      .from('workspace_folders')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setError(null)
          setFolders((data ?? []) as WorkspaceFolder[])
        }
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createFolder = useCallback(
    async (name: string, parentId: string | null, color: string | null) => {
      const trimmed = name.trim()
      if (!trimmed) return null
      const siblings = folders.filter((f) => f.parent_id === parentId)
      const sortOrder = siblings.reduce((max, f) => Math.max(max, f.sort_order), -1) + 1

      const { data, error: insertError } = await supabase
        .from('workspace_folders')
        .insert({ name: trimmed, parent_id: parentId, color, sort_order: sortOrder })
        .select()
        .single()

      if (insertError || !data) {
        setError(friendly(insertError?.message ?? 'Failed to create folder'))
        return null
      }
      setError(null)
      const created = data as WorkspaceFolder
      setFolders((prev) => [...prev, created])
      return created
    },
    [folders]
  )

  const updateFolder = useCallback(
    async (id: string, patch: WorkspaceFolderPatch) => {
      const target = folders.find((f) => f.id === id)
      if (!target) return false

      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
      setError(null)

      const { error: updateError } = await supabase.from('workspace_folders').update(patch).eq('id', id)
      if (updateError) {
        setFolders((prev) => prev.map((f) => (f.id === id ? target : f)))
        setError(friendly(updateError.message))
        return false
      }
      return true
    },
    [folders]
  )

  const deleteFolder = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from('workspace_folders').delete().eq('id', id)
      if (deleteError) {
        setError(friendly(deleteError.message))
        return false
      }
      setError(null)
      refresh()
      return true
    },
    [refresh]
  )

  return { folders, loading, error, refresh, createFolder, updateFolder, deleteFolder }
}
