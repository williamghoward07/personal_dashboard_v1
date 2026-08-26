'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { NotesDocument, Todo } from '@/lib/types'

export interface UseModuleNotesDocumentsResult {
  documents: NotesDocument[]
  todosByDocumentId: Map<string, Todo[]>
  loading: boolean
  error: string | null
  refresh: () => void
  // Finds the existing document for a page, or creates one — called the
  // first time a page gains a linked todo. Safe to call repeatedly for the
  // same page: the unique (module_id, onenote_page_id) constraint means a
  // second call reuses the row via upsert rather than duplicating it.
  ensureDocument: (onenotePageId: string, pageTitle: string) => Promise<NotesDocument | null>
  addTodo: (documentId: string, title: string) => Promise<void>
  toggleTodo: (todoId: string) => Promise<void>
  // Clears the todo's notes_document_id — the todo itself isn't deleted,
  // it just stops being attached to this document (same "unlist, don't
  // delete" convention as todo lists).
  unlinkTodo: (todoId: string) => Promise<void>
}

// One combined fetch/state store per module, shared by OneNoteSectionBrowser
// (to show a progress bar per page) and whichever page's "attach todos"
// panel is currently open — avoids a second round-trip when opening that
// panel for a page whose progress is already on screen.
export function useModuleNotesDocuments(moduleId: string): UseModuleNotesDocumentsResult {
  const [documents, setDocuments] = useState<NotesDocument[]>([])
  const [todosByDocumentId, setTodosByDocumentId] = useState<Map<string, Todo[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    supabase
      .from('notes_documents')
      .select('*')
      .eq('module_id', moduleId)
      .then(async ({ data: docsData, error: docsError }) => {
        if (docsError) {
          setError(docsError.message)
          setLoading(false)
          return
        }
        const docs = (docsData ?? []) as NotesDocument[]
        setDocuments(docs)

        if (docs.length === 0) {
          setTodosByDocumentId(new Map())
          setError(null)
          setLoading(false)
          return
        }

        const { data: todosData, error: todosError } = await supabase
          .from('todos')
          .select('*')
          .in('notes_document_id', docs.map((d) => d.id))

        if (todosError) {
          setError(todosError.message)
          setLoading(false)
          return
        }

        const grouped = new Map<string, Todo[]>()
        for (const todo of (todosData ?? []) as Todo[]) {
          if (!todo.notes_document_id) continue
          const bucket = grouped.get(todo.notes_document_id)
          if (bucket) bucket.push(todo)
          else grouped.set(todo.notes_document_id, [todo])
        }
        setTodosByDocumentId(grouped)
        setError(null)
        setLoading(false)
      })
  }, [moduleId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const ensureDocument = useCallback(
    async (onenotePageId: string, pageTitle: string): Promise<NotesDocument | null> => {
      const existing = documents.find((d) => d.onenote_page_id === onenotePageId)
      if (existing) return existing

      const { data, error: upsertError } = await supabase
        .from('notes_documents')
        .upsert(
          { module_id: moduleId, onenote_page_id: onenotePageId, page_title: pageTitle },
          { onConflict: 'module_id,onenote_page_id' }
        )
        .select('*')
        .single()

      if (upsertError || !data) {
        setError(upsertError?.message ?? 'Failed to set up this page for todos')
        return null
      }

      const created = data as NotesDocument
      setDocuments((prev) => [...prev, created])
      return created
    },
    [documents, moduleId]
  )

  const addTodo = useCallback(async (documentId: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return

    const { data, error: insertError } = await supabase
      .from('todos')
      .insert({ title: trimmed, notes_document_id: documentId })
      .select('*')
      .single()

    if (insertError || !data) {
      setError(insertError?.message ?? 'Failed to add todo')
      return
    }

    const created = data as Todo
    setTodosByDocumentId((prev) => {
      const next = new Map(prev)
      next.set(documentId, [...(next.get(documentId) ?? []), created])
      return next
    })
  }, [])

  const findDocumentIdForTodo = useCallback(
    (todoId: string): string | undefined => {
      for (const [documentId, todos] of todosByDocumentId) {
        if (todos.some((t) => t.id === todoId)) return documentId
      }
      return undefined
    },
    [todosByDocumentId]
  )

  const toggleTodo = useCallback(
    async (todoId: string) => {
      const documentId = findDocumentIdForTodo(todoId)
      if (!documentId) return
      const target = todosByDocumentId.get(documentId)?.find((t) => t.id === todoId)
      if (!target) return

      const nextCompletedAt = target.completed_at ? null : new Date().toISOString()

      setTodosByDocumentId((prev) => {
        const next = new Map(prev)
        next.set(
          documentId,
          (next.get(documentId) ?? []).map((t) => (t.id === todoId ? { ...t, completed_at: nextCompletedAt } : t))
        )
        return next
      })

      const { error: updateError } = await supabase.from('todos').update({ completed_at: nextCompletedAt }).eq('id', todoId)
      if (updateError) {
        setError(updateError.message)
        refresh()
      }
    },
    [findDocumentIdForTodo, todosByDocumentId, refresh]
  )

  const unlinkTodo = useCallback(
    async (todoId: string) => {
      const documentId = findDocumentIdForTodo(todoId)
      if (!documentId) return

      setTodosByDocumentId((prev) => {
        const next = new Map(prev)
        next.set(documentId, (next.get(documentId) ?? []).filter((t) => t.id !== todoId))
        return next
      })

      const { error: updateError } = await supabase.from('todos').update({ notes_document_id: null }).eq('id', todoId)
      if (updateError) {
        setError(updateError.message)
        refresh()
      }
    },
    [findDocumentIdForTodo, refresh]
  )

  return { documents, todosByDocumentId, loading, error, refresh, ensureDocument, addTodo, toggleTodo, unlinkTodo }
}
