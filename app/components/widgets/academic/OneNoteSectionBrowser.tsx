'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, FileText } from 'lucide-react'

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
 */
export default function OneNoteSectionBrowser({
  sectionId,
  sectionName,
}: {
  sectionId: string
  sectionName: string
}) {
  const [pages, setPages] = useState<OneNotePageSummary[] | null>(null)
  const [pagesError, setPagesError] = useState<string | null>(null)

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
              return (
                <li key={page.id}>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-on-surface hover:bg-surface-container-high"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" />
                      <span className="min-w-0 flex-1 truncate">{page.title}</span>
                      <span className="shrink-0 text-xs text-on-surface-variant">{formatModified(page.lastModifiedDateTime)}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-on-surface-variant" />
                    </a>
                  ) : (
                    <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-on-surface-variant/60">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{page.title}</span>
                      <span className="shrink-0 text-xs">{formatModified(page.lastModifiedDateTime)}</span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
