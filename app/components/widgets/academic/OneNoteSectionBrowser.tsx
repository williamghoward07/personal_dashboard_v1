'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, FileText, ListTodo } from 'lucide-react'
import { useModuleNotesDocuments } from '@/lib/education/use-notes-document-todos'
import NotesDocumentTodosModal from './NotesDocumentTodosModal'

interface OneNotePageSummary {
  id: string
  title: string
  lastModifiedDateTime: string
  links?: { oneNoteWebUrl?: { href: string } }
}

function formatModified(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Lists a linked OneNote section's pages — browsing only, no in-app
 * content reading (that was tried and dropped: Graph's stable API doesn't
 * return handwriting, and the beta ink fallback didn't work reliably
 * either). Each page opens directly in OneNote. Fetched only when this
 * panel is shown, nothing polls or preloads.
 *
 * Each page can also have todos attached (see NotesDocumentTodosModal) —
 * a page with linked todos shows an inline progress bar; the "attach"
 * button on any page opens the same panel, lazily creating its
 * notes_documents row on the first todo added.
 */
export default function OneNoteSectionBrowser({
  moduleId,
  sectionId,
  sectionName,
}: {
  moduleId: string
  sectionId: string
  sectionName: string
}) {
  const [pages, setPages] = useState<OneNotePageSummary[] | null>(null)
  const [pagesError, setPagesError] = useState<string | null>(null)
  const [openPage, setOpenPage] = useState<OneNotePageSummary | null>(null)

  const { documents, todosByDocumentId, ensureDocument, addTodo, toggleTodo, unlinkTodo } =
    useModuleNotesDocuments(moduleId)

  const loadPages = (id: string) => {
    setPages(null)
    setPagesError(null)
    fetch(`/api/microsoft/onenote/pages?sectionId=${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((body) => {
        if (body.error) {
          setPagesError(body.error)
          return
        }
        setPages(body.pages ?? [])
      })
      .catch(() => setPagesError("Couldn't reach the server."))
  }

  useEffect(() => {
    loadPages(sectionId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId])

  const openDocumentTodos = openPage
    ? (documents.find((d) => d.onenote_page_id === openPage.id) ?? null)
    : null
  const openTodos = openDocumentTodos ? (todosByDocumentId.get(openDocumentTodos.id) ?? []) : []

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{sectionName}</p>
      <div className="flex max-h-128 flex-col gap-0.5 overflow-y-auto">
        {pagesError ? (
          <p className="px-1 text-xs text-error">{pagesError}</p>
        ) : pages === null ? (
          <p className="px-1 text-xs text-on-surface-variant">Loading pages…</p>
        ) : pages.length === 0 ? (
          <p className="px-1 text-xs text-on-surface-variant">No pages in this section.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {pages.map((page) => {
              const href = page.links?.oneNoteWebUrl?.href
              const document = documents.find((d) => d.onenote_page_id === page.id)
              const todos = document ? (todosByDocumentId.get(document.id) ?? []) : []
              const completed = todos.filter((t) => t.completed_at !== null).length

              return (
                <li key={page.id} className="flex flex-col gap-1 rounded-md px-2 py-1.5 hover:bg-surface-container-high">
                  <div className="flex w-full items-center gap-2">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-w-0 flex-1 items-center gap-2 text-sm text-on-surface hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" />
                        <span className="min-w-0 flex-1 truncate">{page.title}</span>
                      </a>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-on-surface-variant/60">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{page.title}</span>
                      </div>
                    )}
                    <span className="shrink-0 text-xs text-on-surface-variant">
                      {formatModified(page.lastModifiedDateTime)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenPage(page)}
                      aria-label={
                        todos.length > 0 ? `${completed} of ${todos.length} todos complete for ${page.title}` : `Attach todos to ${page.title}`
                      }
                      title={todos.length > 0 ? `${completed}/${todos.length} todos complete` : 'Attach todos'}
                      className="flex shrink-0 items-center gap-1 rounded p-1 text-on-surface-variant hover:bg-surface-container-highest hover:text-academic-orange"
                    >
                      <ListTodo className="h-3.5 w-3.5" />
                      {todos.length > 0 && <span className="text-[10px] tabular-nums">{completed}/{todos.length}</span>}
                    </button>
                    {href && <ExternalLink className="h-3 w-3 shrink-0 text-on-surface-variant" />}
                  </div>

                  {todos.length > 0 && (
                    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
                      <div
                        className="h-full rounded-full bg-academic-orange transition-all"
                        style={{ width: `${(completed / todos.length) * 100}%` }}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {openPage && (
        <NotesDocumentTodosModal
          pageTitle={openPage.title}
          todos={openTodos}
          onAddTodo={async (title) => {
            const doc = openDocumentTodos ?? (await ensureDocument(openPage.id, openPage.title))
            if (doc) addTodo(doc.id, title)
          }}
          onToggleTodo={toggleTodo}
          onUnlinkTodo={unlinkTodo}
          onClose={() => setOpenPage(null)}
        />
      )}
    </div>
  )
}
