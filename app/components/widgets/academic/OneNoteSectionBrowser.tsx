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
 * Browses one linked OneNote section in-app: a persistent scrollable page
 * list on the left, selected page content on the right — both panes stay
 * visible and scroll independently, like a mail client's message list +
 * reading pane. Every fetch here happens only in direct response to
 * opening the panel or a specific page — nothing polls or preloads.
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
  const [selectedPage, setSelectedPage] = useState<OneNotePageSummary | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [contentError, setContentError] = useState<string | null>(null)
  const [loadingHtml, setLoadingHtml] = useState(false)

  const loadPages = (id: string) => {
    setPages(null)
    setPagesError(null)
    setSelectedPage(null)
    setHtml(null)
    setContentError(null)
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

  const openPage = (page: OneNotePageSummary) => {
    setSelectedPage(page)
    setHtml(null)
    setContentError(null)
    setLoadingHtml(true)
    fetch(`/api/microsoft/onenote/page?pageId=${encodeURIComponent(page.id)}`)
      .then((res) => res.json())
      .then((body) => {
        if (body.error) {
          setContentError(body.error)
          return
        }
        setHtml(body.html ?? '')
      })
      .catch(() => setContentError("Couldn't load that page."))
      .finally(() => setLoadingHtml(false))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{sectionName}</p>
      <div className="flex gap-3">
        <div className="flex max-h-128 w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-outline-variant pr-2">
          {pagesError ? (
            <p className="px-1 text-xs text-error">{pagesError}</p>
          ) : pages === null ? (
            <p className="px-1 text-xs text-on-surface-variant">Loading pages…</p>
          ) : pages.length === 0 ? (
            <p className="px-1 text-xs text-on-surface-variant">No pages in this section.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {pages.map((page) => (
                <li key={page.id}>
                  <button
                    type="button"
                    onClick={() => openPage(page)}
                    className={`flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-container-high ${
                      selectedPage?.id === page.id ? 'bg-academic-orange/10 text-academic-orange' : 'text-on-surface'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{page.title}</span>
                    </span>
                    <span className="pl-5 text-xs text-on-surface-variant">{formatModified(page.lastModifiedDateTime)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {!selectedPage ? (
            <p className="px-1 text-xs text-on-surface-variant">Select a page to view it.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-on-surface">{selectedPage.title}</span>
                {selectedPage.links?.oneNoteWebUrl?.href && (
                  <a
                    href={selectedPage.links.oneNoteWebUrl.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex shrink-0 items-center gap-1 text-xs text-academic-orange hover:underline"
                  >
                    Open in OneNote <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {contentError && <p className="text-xs text-error">{contentError}</p>}
              {loadingHtml ? (
                <p className="text-xs text-on-surface-variant">Loading page…</p>
              ) : (
                <div
                  className="max-h-120 overflow-auto rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm text-on-surface [&_img]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: html ?? '' }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
