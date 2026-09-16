'use client'

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import Link from 'next/link'
import { ArrowRight, Send, Sparkles, Square, X } from 'lucide-react'
import LoadingGlowBorder from './LoadingGlowBorder'
import LiquidSwitch from './LiquidSwitch'
import DraftList from './capture/DraftList'
import type { SearchModule } from '@/lib/search/nl-search'
import type { SearchResultItem } from '@/lib/search/types'
import { resolveQueryMode, type QueryMode, type ResolvedQueryMode } from '@/lib/search/query-mode'
import { captureStore } from '@/lib/braindump/store'

const MODULE_HREF: Record<SearchModule, string> = {
  people: '/people',
  tasks: '/education',
  todos: '/todos',
  transactions: '/money',
  habits: '/habits',
  prompts: '/research',
}

// PeopleDirectoryCard deep-links straight to a person's detail view via
// ?person=<id> (see app/people/page.tsx); other modules land on the page only.
function resultHref(result: SearchResultItem): string {
  if (result.module === 'people') return `/people?person=${result.id}`
  return MODULE_HREF[result.module]
}

const MODULE_LABEL: Record<SearchModule, string> = {
  people: 'Person',
  tasks: 'Task',
  todos: 'Todo',
  transactions: 'Transaction',
  habits: 'Habit',
  prompts: 'Prompt',
}

const MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'find', label: 'Find' },
  { value: 'ask', label: 'Ask' },
  { value: 'capture', label: 'Capture' },
] as const satisfies readonly { value: QueryMode; label: string }[]

const MODE_HINT: Record<QueryMode, string> = {
  auto: 'Picks for you: questions get answered, instructions and lists get captured, anything else is searched.',
  find: 'Searches your modules for matching items. Changes nothing.',
  ask: 'Searches, then answers your question from what it found. Changes nothing.',
  capture:
    'Splits what you type into todos, deadlines, events and people updates. Nothing is saved until you confirm.',
}

const PLACEHOLDER: Record<QueryMode, string> = {
  auto: 'Search, ask a question, or jot down things to add…',
  find: 'Search people, todos, tasks, money, habits, prompts…',
  ask: 'e.g. what did I spend on food this month?',
  capture: 'e.g. essay plan due friday, call mum tomorrow, met Sam at church',
}

const RESOLVED_LABEL: Record<ResolvedQueryMode, string> = { find: 'Find', ask: 'Ask', capture: 'Capture' }

// Token-saving: a search only fires on submit (Enter/Send), never on
// type, and nothing shorter than this is sent at all.
const MIN_QUERY_LENGTH = 3
const MAX_TEXTAREA_PX = 160

interface SearchResponse {
  results: SearchResultItem[]
  answer: string | null
}

// Session-lifetime cache of identical (normalised) queries per mode — a
// repeat costs nothing. Module scope so it survives navigating away from
// and back to the home page within the same tab.
const searchCache = new Map<string, SearchResponse>()

// The home "System Query" box. One input, four explicit modes (see
// lib/search/query-mode.ts): Find and Ask go to app/api/search; Capture
// goes to the same extractor as the Brain Dump page, and every draft it
// produces needs a Confirm (or "Confirm all") before anything is written.
export default function AiQueryBar() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<QueryMode>('auto')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [search, setSearch] = useState<(SearchResponse & { mode: ResolvedQueryMode }) | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const capture = useSyncExternalStore(captureStore.subscribe, captureStore.getSnapshot, captureStore.getSnapshot)

  // Grow with the text, up to a cap, then scroll.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`
  }, [query])

  const trimmedQuery = query.trim()
  const queryLongEnough = trimmedQuery.length >= MIN_QUERY_LENGTH
  const loading = searchLoading || capture.loading
  const autoTarget = mode === 'auto' && queryLongEnough ? resolveQueryMode('auto', trimmedQuery) : null

  const runSearch = async (text: string, resolved: 'find' | 'ask') => {
    const cacheKey = `${resolved}:${text.toLowerCase()}`
    const cached = searchCache.get(cacheKey)
    if (cached) {
      setSearch({ ...cached, mode: resolved })
      setSearchError(null)
      return
    }

    setSearchLoading(true)
    setSearchError(null)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, mode: resolved }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setSearchError(body?.error ?? "Couldn't search right now.")
        return
      }
      const data = (await res.json()) as SearchResponse
      searchCache.set(cacheKey, data)
      setSearch({ ...data, mode: resolved })
    } catch {
      setSearchError("Couldn't reach the search service — try again in a moment.")
    } finally {
      setSearchLoading(false)
    }
  }

  const submit = async () => {
    if (!queryLongEnough || loading) return
    const resolved = resolveQueryMode(mode, trimmedQuery)
    setPanelOpen(true)
    if (resolved === 'capture') {
      setSearch(null)
      setSearchError(null)
      if (await captureStore.submit(trimmedQuery)) setQuery('')
    } else {
      await runSearch(trimmedQuery, resolved)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  const closePanel = () => {
    setPanelOpen(false)
    captureStore.setError(null)
  }

  const hasDrafts = capture.drafts.length > 0
  const showPanel = panelOpen && Boolean(search || hasDrafts || capture.error)
  const loadingLabel = capture.loading
    ? 'Reading that…'
    : resolveQueryMode(mode, trimmedQuery) === 'ask'
      ? 'Searching and answering…'
      : 'Searching…'

  return (
    <div className="relative">
      <LoadingGlowBorder loading={loading} className="rounded-xl">
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-xl border border-outline-variant bg-linear-to-br from-surface-container-low to-surface-container-lowest p-6 transition-all hover:border-academic-orange/40 hover:shadow-[0_0_15px_rgba(255,107,0,0.15)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-academic-orange bg-academic-orange/20 text-academic-orange">
                <Sparkles className="h-4 w-4" />
              </div>
              <h2 className="font-display text-headline-md text-on-surface">System Query</h2>
            </div>
            <LiquidSwitch options={MODE_OPTIONS} value={mode} onChange={setMode} accent="orange" />
          </div>

          <div className="relative mt-4">
            <textarea
              ref={textareaRef}
              rows={1}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={PLACEHOLDER[mode]}
              disabled={loading}
              aria-label="Search, ask or capture"
              className="block w-full resize-none rounded-lg border border-outline-variant bg-surface-container-lowest py-3.5 pl-4 pr-12 text-sm leading-5 text-on-surface outline-none placeholder:text-on-surface-variant focus:border-academic-orange disabled:opacity-60"
            />
            {capture.loading ? (
              <button
                type="button"
                onClick={captureStore.stop}
                aria-label="Stop"
                className="absolute bottom-3.5 right-3 text-academic-orange"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !queryLongEnough}
                aria-label="Submit"
                className="absolute bottom-3.5 right-3 text-academic-orange disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-xs text-on-surface-variant">
            <p className="min-w-0 flex-1">{MODE_HINT[mode]}</p>
            {autoTarget && (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-academic-orange/40 px-2 py-0.5 text-academic-orange">
                <ArrowRight className="h-3 w-3" />
                {RESOLVED_LABEL[autoTarget]}
              </span>
            )}
          </div>
          {loading && <p className="mt-1 text-xs text-on-surface-variant">{loadingLabel}</p>}
          {searchError && <p className="mt-1 text-xs text-error">{searchError}</p>}
        </form>
      </LoadingGlowBorder>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 flex max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-low p-3 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {hasDrafts ? 'Captured' : search ? RESOLVED_LABEL[search.mode] : 'Capture'}
            </p>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close results"
              className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {capture.error && <p className="text-xs text-error">{capture.error}</p>}

          {hasDrafts && (
            <DraftList store={captureStore} tone="orange" gridClassName="grid grid-cols-1 gap-2 md:grid-cols-2" />
          )}

          {search && (
            <div className={hasDrafts ? 'border-t border-outline-variant/50 pt-3' : undefined}>
              {search.answer && (
                <p className="mb-2 rounded-lg bg-surface-container-high p-3 text-sm text-on-surface">{search.answer}</p>
              )}
              {search.results.length === 0 ? (
                !search.answer && (
                  <p className="p-1 text-sm text-on-surface-variant">
                    {search.mode === 'ask' ? "Couldn't find anything to answer that from." : 'No matches.'}
                  </p>
                )
              ) : (
                <ul className="flex flex-col gap-1">
                  {search.results.map((result) => (
                    <li key={`${result.module}-${result.id}`}>
                      <Link
                        href={resultHref(result)}
                        onClick={closePanel}
                        className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-surface-container-high"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-on-surface">{result.title}</span>
                        {result.subtitle && (
                          <span className="shrink-0 truncate text-xs text-on-surface-variant">{result.subtitle}</span>
                        )}
                        <span className="shrink-0 rounded-full bg-surface-container-highest px-1.5 py-0.5 text-[10px] text-on-surface-variant">
                          {MODULE_LABEL[result.module]}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
