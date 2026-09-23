'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { AtSign, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { InstagramFollow, Person } from '@/lib/types'
import {
  listFollows,
  linkFollow,
  unlinkFollow,
  updateFollowNote,
  updateFollowCategory,
  bulkSetCategory,
  bulkUnlinkFollows,
  bulkLinkFollows,
} from '@/lib/instagram/follows'
import { filterFollows, sortFollows, type FollowSort, type FollowStatusFilter } from '@/lib/instagram/list'
import { suggestMatch, describeMatchBatch, type MatchSuggestion } from '@/lib/instagram/match'
import { buildFollowsCsv, followsExportFilename, type FollowExportRow } from '@/lib/instagram/export'
import { useStoredIdSet } from '@/lib/utils/use-stored-id-set'
import { getPageNumbers, getPageWindow, paginate } from '@/lib/ui/pagination'
import { Button } from '@/components/ui/button'
import { DataTable, DataTableBody, DataTableHead, DataTableHeaderCell } from '@/components/ui/data-table'
import WidgetCard from '../../WidgetCard'
import ConfirmDialog from '../../ConfirmDialog'
import InstagramFollowsStats from './InstagramFollowsStats'
import InstagramFollowsFilters from './InstagramFollowsFilters'
import InstagramFollowRow from './InstagramFollowRow'
import InstagramBulkActionBar from './InstagramBulkActionBar'
import InstagramImportPanel from './InstagramImportPanel'

const MIGRATION_HINT = 'Has supabase/migrations/20260918000000_instagram_follows.sql been run?'
const PAGE_SIZE = 25

interface BatchCandidate {
  follow: InstagramFollow
  person: Person
  score: number
}

export default function InstagramFollowsCard({ people }: { people: Person[] }) {
  const [follows, setFollows] = useState<InstagramFollow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<FollowStatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [sort, setSort] = useState<FollowSort>('followed_desc')
  const [page, setPage] = useState(1)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useStoredIdSet('instagram-follows:dismissed-suggestions')
  const [batchCandidates, setBatchCandidates] = useState<BatchCandidate[] | null>(null)
  const [confirmingUnlink, setConfirmingUnlink] = useState(false)

  const categoryListId = useId()

  const refresh = () => {
    listFollows(supabase)
      .then((data) => {
        setFollows(data)
        setError(null)
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'unknown error'
        setError(`Couldn't load follows: ${msg}. ${MIGRATION_HINT}`)
      })
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  const counts = useMemo(
    () => ({
      all: follows.length,
      linked: follows.filter((f) => f.person_id).length,
      unlinked: follows.filter((f) => !f.person_id).length,
    }),
    [follows]
  )

  const categories = useMemo(
    () => [...new Set(follows.map((f) => f.category).filter((c): c is string => Boolean(c)))].sort(),
    [follows]
  )

  const filtered = useMemo(
    () => sortFollows(filterFollows(follows, { query, status, category: categoryFilter }), sort),
    [follows, query, status, categoryFilter, sort]
  )

  const pageWindow = useMemo(() => getPageWindow(filtered.length, page, PAGE_SIZE), [filtered.length, page])
  const pageItems = useMemo(() => paginate(filtered, page, PAGE_SIZE), [filtered, page])
  const pageNumbers = useMemo(
    () => (pageWindow.pageCount > 1 ? getPageNumbers(pageWindow.page, pageWindow.pageCount) : []),
    [pageWindow.page, pageWindow.pageCount]
  )

  // Any change to the search/filter/sort inputs invalidates the current
  // page — e.g. narrowing to "unlinked" while on page 4 of "all" would
  // otherwise strand the view on a page that no longer exists.
  function resetToFirstPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  const suggestions = useMemo(() => {
    const map = new Map<string, MatchSuggestion>()
    for (const f of follows) {
      if (f.person_id || dismissed.has(f.id)) continue
      const s = suggestMatch(f, people)
      if (s) map.set(f.id, s)
    }
    return map
  }, [follows, people, dismissed])

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const clearSelection = () => setSelectedIds(new Set())

  const allFilteredSelected = filtered.length > 0 && filtered.every((f) => selectedIds.has(f.id))
  const toggleSelectAllFiltered = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) filtered.forEach((f) => next.delete(f.id))
      else filtered.forEach((f) => next.add(f.id))
      return next
    })

  const link = async (id: string, personId: string) => {
    try {
      await linkFollow(supabase, id, personId)
      setFollows((prev) => prev.map((f) => (f.id === id ? { ...f, person_id: personId } : f)))
    } catch (e) {
      setError(`Couldn't link: ${(e as Error).message}`)
    }
  }

  const unlink = async (id: string) => {
    try {
      await unlinkFollow(supabase, id)
      setFollows((prev) => prev.map((f) => (f.id === id ? { ...f, person_id: null } : f)))
    } catch (e) {
      setError(`Couldn't unlink: ${(e as Error).message}`)
    }
  }

  const saveNote = async (id: string, note: string | null) => {
    try {
      await updateFollowNote(supabase, id, note)
      setFollows((prev) => prev.map((f) => (f.id === id ? { ...f, note } : f)))
    } catch (e) {
      setError(`Couldn't save note: ${(e as Error).message}`)
    }
  }

  const saveCategory = async (id: string, category: string | null) => {
    try {
      await updateFollowCategory(supabase, id, category)
      setFollows((prev) => prev.map((f) => (f.id === id ? { ...f, category } : f)))
    } catch (e) {
      setError(`Couldn't save category: ${(e as Error).message}`)
    }
  }

  const dismissSuggestion = (id: string) => setDismissed(new Set(dismissed).add(id))

  const openBatchAutoMatch = (scopeIds?: Set<string>) => {
    const candidates: BatchCandidate[] = []
    for (const f of follows) {
      if (f.person_id) continue
      if (scopeIds && !scopeIds.has(f.id)) continue
      const s = suggestions.get(f.id)
      if (s) candidates.push({ follow: f, person: s.person, score: s.score })
    }
    if (candidates.length > 0) setBatchCandidates(candidates)
  }

  const confirmBatchAutoMatch = async () => {
    if (!batchCandidates) return
    const candidates = batchCandidates
    try {
      await bulkLinkFollows(
        supabase,
        candidates.map((c) => ({ id: c.follow.id, personId: c.person.id }))
      )
      const linkedIds = new Map(candidates.map((c) => [c.follow.id, c.person.id]))
      setFollows((prev) => prev.map((f) => (linkedIds.has(f.id) ? { ...f, person_id: linkedIds.get(f.id)! } : f)))
      setMessage(`Linked ${candidates.length} follow${candidates.length === 1 ? '' : 's'}.`)
    } catch (e) {
      setError(`Couldn't batch-link: ${(e as Error).message}`)
    } finally {
      setBatchCandidates(null)
      clearSelection()
    }
  }

  const applyBulkCategory = async (category: string) => {
    const ids = [...selectedIds]
    try {
      await bulkSetCategory(supabase, ids, category)
      setFollows((prev) => prev.map((f) => (ids.includes(f.id) ? { ...f, category } : f)))
      clearSelection()
    } catch (e) {
      setError(`Couldn't apply category: ${(e as Error).message}`)
    }
  }

  const confirmBulkUnlink = async () => {
    const ids = [...selectedIds]
    try {
      await bulkUnlinkFollows(supabase, ids)
      setFollows((prev) => prev.map((f) => (ids.includes(f.id) ? { ...f, person_id: null } : f)))
    } catch (e) {
      setError(`Couldn't unlink: ${(e as Error).message}`)
    } finally {
      setConfirmingUnlink(false)
      clearSelection()
    }
  }

  const toExportRow = (f: InstagramFollow): FollowExportRow => ({
    handle: f.handle,
    display_name: f.display_name,
    followed_at: f.followed_at,
    category: f.category,
    note: f.note,
    person_full_name: f.person_id ? (peopleById.get(f.person_id)?.full_name ?? null) : null,
  })

  const exportCsv = (rows: InstagramFollow[]) => {
    const csv = buildFollowsCsv(rows.map(toExportRow))
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = followsExportFilename('csv')
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const selectedHasSuggestion = [...selectedIds].some((id) => suggestions.has(id))

  return (
    <WidgetCard
      title="Instagram follows"
      accent="amber"
      icon={<AtSign className="h-4 w-4" />}
      className="sm:col-span-2 xl:col-span-2"
    >
      <div className="flex flex-col gap-3">
        {error && (
          <p role="alert" className="text-xs text-error">
            {error}
          </p>
        )}
        {message && <p className="text-xs text-on-surface-variant">{message}</p>}

        {loading ? (
          <p className="text-xs">Loading…</p>
        ) : follows.length === 0 ? (
          <>
            <p className="text-xs">No follows imported yet.</p>
            <InstagramImportPanel onImported={refresh} />
          </>
        ) : (
          <>
            <InstagramFollowsStats total={counts.all} linked={counts.linked} unlinked={counts.unlinked} />

            <InstagramFollowsFilters
              query={query}
              onQueryChange={resetToFirstPage(setQuery)}
              status={status}
              onStatusChange={resetToFirstPage(setStatus)}
              counts={counts}
              category={categoryFilter}
              onCategoryChange={resetToFirstPage(setCategoryFilter)}
              categories={categories}
              sort={sort}
              onSortChange={resetToFirstPage(setSort)}
            />

            <datalist id={categoryListId}>
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <label className="flex items-center gap-1.5 text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  className="h-3.5 w-3.5 accent-people-amber"
                />
                Select all ({filtered.length})
              </label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => openBatchAutoMatch()} disabled={suggestions.size === 0}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Auto-match all unlinked ({suggestions.size})
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportCsv(filtered)}>
                  Export ({filtered.length})
                </Button>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <InstagramBulkActionBar
                selectedCount={selectedIds.size}
                autoMatchAvailable={selectedHasSuggestion}
                onAutoMatch={() => openBatchAutoMatch(selectedIds)}
                categoryListId={categoryListId}
                onApplyCategory={applyBulkCategory}
                onExport={() => exportCsv(filtered.filter((f) => selectedIds.has(f.id)))}
                onUnlink={() => setConfirmingUnlink(true)}
                onClear={clearSelection}
              />
            )}

            {filtered.length === 0 ? (
              <p className="text-xs">No follows match the current search/filter.</p>
            ) : (
              <>
                <div className="max-h-128 overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-low">
                  <DataTable>
                    <DataTableHead>
                      <tr>
                        <DataTableHeaderCell>Account</DataTableHeaderCell>
                        <DataTableHeaderCell>Display name</DataTableHeaderCell>
                        <DataTableHeaderCell>Category</DataTableHeaderCell>
                        <DataTableHeaderCell>Note</DataTableHeaderCell>
                        <DataTableHeaderCell>Person</DataTableHeaderCell>
                        <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
                      </tr>
                    </DataTableHead>
                    <DataTableBody>
                      {pageItems.map((f) => (
                        <InstagramFollowRow
                          key={f.id}
                          follow={f}
                          people={people}
                          linkedPerson={f.person_id ? (peopleById.get(f.person_id) ?? null) : null}
                          selected={selectedIds.has(f.id)}
                          onToggleSelect={() => toggleSelect(f.id)}
                          onLink={(personId) => link(f.id, personId)}
                          onUnlink={() => unlink(f.id)}
                          onNoteChange={(note) => saveNote(f.id, note)}
                          onCategoryChange={(cat) => saveCategory(f.id, cat)}
                          categoryListId={categoryListId}
                          suggestion={suggestions.get(f.id) ?? null}
                          onAcceptSuggestion={() => {
                            const s = suggestions.get(f.id)
                            if (s) link(f.id, s.person.id)
                          }}
                          onDismissSuggestion={() => dismissSuggestion(f.id)}
                        />
                      ))}
                    </DataTableBody>
                  </DataTable>
                </div>

                {pageWindow.pageCount > 1 && (
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="quiet"
                      size="icon-sm"
                      aria-label="Previous page"
                      disabled={!pageWindow.hasPrevious}
                      onClick={() => setPage(pageWindow.page - 1)}
                      className="disabled:opacity-30"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    {pageNumbers.map((token, i) =>
                      token === 'ellipsis' ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-xs text-outline">
                          …
                        </span>
                      ) : (
                        <button
                          key={token}
                          type="button"
                          onClick={() => setPage(token)}
                          aria-current={token === pageWindow.page ? 'page' : undefined}
                          className={`h-8 min-w-8 rounded-lg px-2 text-xs font-medium tabular-nums transition-colors ${
                            token === pageWindow.page
                              ? 'bg-primary-container text-on-primary-container'
                              : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                          }`}
                        >
                          {token}
                        </button>
                      )
                    )}
                    <Button
                      variant="quiet"
                      size="icon-sm"
                      aria-label="Next page"
                      disabled={!pageWindow.hasNext}
                      onClick={() => setPage(pageWindow.page + 1)}
                      className="disabled:opacity-30"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </>
            )}

            <InstagramImportPanel onImported={refresh} />
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={batchCandidates !== null}
        message={batchCandidates ? describeMatchBatch(batchCandidates) : ''}
        confirmLabel="Link all"
        onCancel={() => setBatchCandidates(null)}
        onConfirm={confirmBatchAutoMatch}
      />

      <ConfirmDialog
        isOpen={confirmingUnlink}
        message={`Unlink ${selectedIds.size} follow${selectedIds.size === 1 ? '' : 's'} from their person records? Each can be re-linked individually.`}
        confirmLabel="Unlink"
        onCancel={() => setConfirmingUnlink(false)}
        onConfirm={confirmBulkUnlink}
      />
    </WidgetCard>
  )
}
