'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Accent } from '@/lib/theme'
import type { Workspace, WorkspaceFolder } from '@/lib/types'
import { resolveAccent } from './folders'

export interface WorkspaceTag {
  id: string
  title: string
  accent: Accent
}

type LookupWorkspace = Pick<Workspace, 'id' | 'title' | 'color' | 'folder_id'>
type LookupFolder = Pick<WorkspaceFolder, 'id' | 'color' | 'parent_id'>

// id -> {title, colour} for tagging todos with the workspace they belong
// to (Todos page, Daily Goals). Two small column reads, once per mount.
export function useWorkspaceLookup(): Map<string, WorkspaceTag> {
  const [workspaces, setWorkspaces] = useState<LookupWorkspace[]>([])
  const [folders, setFolders] = useState<LookupFolder[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('workspaces').select('id, title, color, folder_id'),
      supabase.from('workspace_folders').select('id, color, parent_id'),
    ]).then(([w, f]) => {
      if (cancelled) return
      setWorkspaces((w.data ?? []) as LookupWorkspace[])
      setFolders((f.data ?? []) as LookupFolder[])
    })
    return () => {
      cancelled = true
    }
  }, [])

  return useMemo(
    () => new Map(workspaces.map((w) => [w.id, { id: w.id, title: w.title, accent: resolveAccent(w, folders) }])),
    [workspaces, folders]
  )
}
