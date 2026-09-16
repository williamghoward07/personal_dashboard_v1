'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { WorkspaceNote, WorkspaceNoteKind } from '@/lib/types'
import { extractHashtags, mergeTags } from './tags'

export interface AddNoteOptions {
  kind?: WorkspaceNoteKind
  footnote?: string | null
  // Chip tags; any inline #hashtags in the body are added automatically.
  tags?: string[]
}

export interface UseWorkspaceNotesResult {
  notes: WorkspaceNote[]
  loading: boolean
  error: string | null
  addNote: (body: string, options?: AddNoteOptions) => Promise<void>
}

// Append-only dated log for one workspace, newest first. Deliberately
// exports no updateNote/deleteNote — the DB itself denies those (see the
// workspace_notes RLS/grant in the migration), and the hook offers no way
// to even attempt one.
export function useWorkspaceNotes(workspaceId: string): UseWorkspaceNotesResult {
  const [notes, setNotes] = useState<WorkspaceNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    supabase
      .from('workspace_notes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setError(null)
          setNotes((data ?? []) as WorkspaceNote[])
        }
        setLoading(false)
      })
  }, [workspaceId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addNote = useCallback(
    async (body: string, { kind = 'note', footnote = null, tags = [] }: AddNoteOptions = {}) => {
      const trimmed = body.trim()
      if (!trimmed) return
      const trimmedFootnote = footnote?.trim() || null
      const allTags = mergeTags(tags, extractHashtags(trimmed))

      const optimisticId = `optimistic-${crypto.randomUUID()}`
      const optimisticNote: WorkspaceNote = {
        id: optimisticId,
        workspace_id: workspaceId,
        body: trimmed,
        kind,
        footnote: trimmedFootnote,
        tags: allTags,
        created_at: new Date().toISOString(),
      }
      // Prepend, not append — this list is newest-first.
      setNotes((prev) => [optimisticNote, ...prev])
      setError(null)

      const { data, error: insertError } = await supabase
        .from('workspace_notes')
        .insert({ workspace_id: workspaceId, body: trimmed, kind, footnote: trimmedFootnote, tags: allTags })
        .select()
        .single()

      if (insertError || !data) {
        setNotes((prev) => prev.filter((n) => n.id !== optimisticId))
        setError(insertError?.message ?? 'Failed to add note')
        return
      }

      const created = data as WorkspaceNote
      setNotes((prev) => prev.map((n) => (n.id === optimisticId ? created : n)))
    },
    [workspaceId]
  )

  return { notes, loading, error, addNote }
}

// Every tag used across all workspaces' logs, for composer suggestions —
// a tag like #pricing is reusable between workspaces. One small column
// read; filtering/counting happens client-side.
export function useAllNoteTags(): { tags: string[] }[] {
  const [rows, setRows] = useState<{ tags: string[] }[]>([])
  useEffect(() => {
    supabase
      .from('workspace_notes')
      .select('tags')
      .then(({ data }) => setRows((data ?? []) as { tags: string[] }[]))
  }, [])
  return rows
}
