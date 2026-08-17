'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { Sparkles, Send } from 'lucide-react'
import type { SearchModule } from '@/lib/search/nl-search'

interface SearchResultItem {
  module: SearchModule
  id: string
  title: string
  subtitle: string | null
}

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

// Submit-triggered, not live-as-you-type — each search is a real Gemini
// call (see /api/search). Results link through to the relevant page,
// not a specific detail view — no page in this app supports deep-linking
// to an open detail modal yet, so this is as far as it goes for now.
export default function AiQueryBar() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResultItem[] | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? "Couldn't search right now.")
        return
      }
      const data = (await res.json()) as { results: SearchResultItem[] }
      setResults(data.results)
    } catch {
      setError("Couldn't reach the search service — try again in a moment.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <form
        onSubmit={handleSubmit}
        className="relative overflow-hidden rounded-xl border border-outline-variant bg-linear-to-br from-surface-container-low to-surface-container-lowest p-6 transition-all hover:border-academic-orange/40 hover:shadow-[0_0_15px_rgba(255,107,0,0.15)]"
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
            placeholder="Ask across your modules — deadlines, spending, sessions, research..."
            disabled={loading}
            aria-label="Search across modules"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-3.5 pl-4 pr-12 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-academic-orange disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            aria-label="Search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-academic-orange disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {loading && <p className="mt-2 text-xs text-on-surface-variant">Searching…</p>}
        {error && <p className="mt-2 text-xs text-error">{error}</p>}
      </form>

      {results && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-96 overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-low p-2 shadow-2xl shadow-black/50">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-on-surface-variant">No matches.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.map((result) => (
                <li key={`${result.module}-${result.id}`}>
                  <Link
                    href={MODULE_HREF[result.module]}
                    onClick={() => setResults(null)}
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
  )
}
