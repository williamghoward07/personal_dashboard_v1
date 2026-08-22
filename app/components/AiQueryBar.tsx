'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { Sparkles, Send, Check, X } from 'lucide-react'
import LoadingGlowBorder from './LoadingGlowBorder'
import type { SearchModule } from '@/lib/search/nl-search'
import type { SearchResultItem } from '@/lib/search/types'
import type { ActDraft, ActEntity } from '@/lib/search/act'
import { looksLikeCommand } from '@/lib/search/act-heuristics'

const MODULE_HREF: Record<SearchModule, string> = {
  people: '/people',
  tasks: '/education',
  todos: '/todos',
  transactions: '/money',
  habits: '/habits',
  prompts: '/research',
}

const MODULE_LABEL: Record<SearchModule, string> = {
  people: 'Person',
  tasks: 'Task',
  todos: 'Todo',
  transactions: 'Transaction',
  habits: 'Habit',
  prompts: 'Prompt',
}

const ACT_ENTITY_LABEL: Record<ActEntity, string> = {
  todo: 'Todo',
  education_task: 'Education task',
  calendar_event: 'Calendar event',
}

// Minimum length is a token-saving measure from the AI Search & Token
// Budget plan (2026-08-18). Search only fires on submit (Enter/Send) —
// no debounce-on-type, so a half-typed query never costs a call.
const MIN_QUERY_LENGTH = 3

interface SearchResponse {
  results: SearchResultItem[]
  answer: string | null
}

interface ActResponse {
  draft: ActDraft | null
}

// Session-lifetime cache of identical (normalised) queries — a second
// search for the same text costs nothing. Deliberately module-scope, not
// component state, so it survives navigating away from and back to the
// home page within the same tab.
const searchCache = new Map<string, SearchResponse>()

export default function AiQueryBar() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResultItem[] | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)

  const [actDraft, setActDraft] = useState<ActDraft | null>(null)
  const [actConfirming, setActConfirming] = useState(false)
  const [actMessage, setActMessage] = useState<string | null>(null)

  const runSearch = async (trimmed: string) => {
    const cacheKey = trimmed.toLowerCase()
    const cached = searchCache.get(cacheKey)
    if (cached) {
      setResults(cached.results)
      setAnswer(cached.answer)
      setActDraft(null)
      setActMessage(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    setActDraft(null)
    setActMessage(null)

    try {
      const searchPromise = fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      })

      // Zero-cost local gate — only spend a second API call on something
      // that already reads as a command, never on an ordinary search.
      const actPromise = looksLikeCommand(trimmed)
        ? fetch('/api/search/act', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: trimmed }),
          })
        : null

      const [searchRes, actRes] = await Promise.all([searchPromise, actPromise])

      if (!searchRes.ok) {
        const body = await searchRes.json().catch(() => null)
        setError(body?.error ?? "Couldn't search right now.")
        return
      }
      const searchData = (await searchRes.json()) as SearchResponse
      searchCache.set(cacheKey, searchData)
      setResults(searchData.results)
      setAnswer(searchData.answer)

      if (actRes?.ok) {
        const actData = (await actRes.json()) as ActResponse
        setActDraft(actData.draft)
      }
    } catch {
      setError("Couldn't reach the search service — try again in a moment.")
    } finally {
      setLoading(false)
    }
  }

  const trimmedQuery = query.trim()
  const queryLongEnough = trimmedQuery.length >= MIN_QUERY_LENGTH

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!queryLongEnough || loading) return
    void runSearch(trimmedQuery)
  }

  const handleConfirmAct = async () => {
    if (!actDraft) return
    setActConfirming(true)
    setActMessage(null)
    try {
      const res = await fetch('/api/search/act/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: actDraft }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setActMessage(body?.message ?? body?.error ?? "Couldn't create that.")
        return
      }
      setActMessage(`${ACT_ENTITY_LABEL[actDraft.entity]} created.`)
      setActDraft(null)
    } catch {
      setActMessage("Couldn't reach the server — try again in a moment.")
    } finally {
      setActConfirming(false)
    }
  }

  const showDropdown = queryLongEnough && Boolean(results || answer || actDraft || actMessage)

  return (
    <div className="relative">
      <LoadingGlowBorder loading={loading} className="rounded-xl">
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-xl border border-outline-variant bg-linear-to-br from-surface-container-low to-surface-container-lowest p-6 transition-all hover:border-academic-orange/40 hover:shadow-[0_0_15px_rgba(255,107,0,0.15)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-academic-orange bg-academic-orange/20 text-academic-orange">
              <Sparkles className="h-4 w-4" />
            </div>
            <h2 className="font-display text-headline-md text-on-surface">System Query</h2>
          </div>
          <div className="relative mt-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask across your modules, or tell it to add something..."
              disabled={loading}
              aria-label="Search across modules"
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-3.5 pl-4 pr-12 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-academic-orange disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !queryLongEnough}
              aria-label="Search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-academic-orange disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {loading && <p className="mt-2 text-xs text-on-surface-variant">Searching…</p>}
          {error && <p className="mt-2 text-xs text-error">{error}</p>}
        </form>
      </LoadingGlowBorder>

      {showDropdown && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-96 overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-low p-2 shadow-2xl shadow-black/50">
          {actDraft && (
            <div className="mb-2 rounded-lg border border-academic-orange/40 bg-academic-orange/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-academic-orange">
                Create {ACT_ENTITY_LABEL[actDraft.entity]}
              </p>
              <p className="mt-1 text-sm text-on-surface">{actDraft.title}</p>
              {(actDraft.due_date || actDraft.due_time) && (
                <p className="text-xs text-on-surface-variant">
                  {actDraft.due_date}
                  {actDraft.due_time ? ` · ${actDraft.due_time}` : ''}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={actConfirming}
                  onClick={handleConfirmAct}
                  className="flex items-center gap-1 rounded-md bg-academic-orange px-2.5 py-1.5 text-xs font-semibold text-surface disabled:opacity-60"
                >
                  <Check className="h-3 w-3" />
                  {actConfirming ? 'Creating…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  disabled={actConfirming}
                  onClick={() => setActDraft(null)}
                  className="flex items-center gap-1 rounded-md border border-outline-variant px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high"
                >
                  <X className="h-3 w-3" />
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {actMessage && !actDraft && <p className="p-2 text-xs text-on-surface-variant">{actMessage}</p>}

          {answer && <p className="mb-2 rounded-lg bg-surface-container-high p-3 text-sm text-on-surface">{answer}</p>}

          {results && results.length === 0 && !answer && !actDraft ? (
            <p className="p-3 text-sm text-on-surface-variant">No matches.</p>
          ) : (
            results &&
            results.length > 0 && (
              <ul className="flex flex-col gap-1">
                {results.map((result) => (
                  <li key={`${result.module}-${result.id}`}>
                    <Link
                      href={MODULE_HREF[result.module]}
                      onClick={() => {
                        setResults(null)
                        setAnswer(null)
                        setActDraft(null)
                      }}
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
            )
          )}
        </div>
      )}
    </div>
  )
}
