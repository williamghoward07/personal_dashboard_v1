import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractSearchQuery, SEARCH_MODULES, type SearchModule } from '@/lib/search/nl-search'
import { ilikeAnyColumn } from '@/lib/search/postgrest-filter'
import { formatPounds, minorUnitsOf } from '@/lib/money'
import type { Transaction } from '@/lib/types'

export interface SearchResultItem {
  module: SearchModule
  id: string
  title: string
  subtitle: string | null
}

const RESULTS_PER_MODULE = 5

// Everything below is plain TypeScript running hand-written ilike
// queries — no AI touches this part at all (see lib/search/nl-search.ts
// for the one call that does, which only ever returns keywords + module
// names, never SQL).
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = (await request.json()) as { query?: string }
  const query = body.query?.trim()

  if (!query) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  let keywords: string[]
  let targetModules: SearchModule[]
  try {
    const extraction = await extractSearchQuery(query)
    keywords = extraction.keywords
    targetModules = extraction.targetModules
  } catch (err) {
    console.error('NL search extraction failed:', err)
    const message = err instanceof Error ? err.message : 'extract_failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  if (keywords.length === 0) {
    return NextResponse.json({ results: [] })
  }

  const modules = targetModules.length > 0 ? targetModules : SEARCH_MODULES
  // Supabase's query builder is "thenable" rather than a full Promise —
  // PromiseLike is the type .then() on it actually produces.
  const searches: PromiseLike<SearchResultItem[]>[] = []

  if (modules.includes('people')) {
    searches.push(
      supabase
        .from('people')
        .select('id, full_name, company, email')
        .or(ilikeAnyColumn(['full_name', 'company', 'email', 'notes'], keywords))
        .limit(RESULTS_PER_MODULE)
        .then(({ data }) =>
          (data ?? []).map((p) => ({
            module: 'people' as const,
            id: p.id,
            title: p.full_name,
            subtitle: p.company ?? p.email ?? null,
          })),
        ),
    )
  }

  if (modules.includes('tasks')) {
    searches.push(
      supabase
        .from('tasks')
        .select('id, title, status, due_date')
        .or(ilikeAnyColumn(['title', 'notes', 'description'], keywords))
        .limit(RESULTS_PER_MODULE)
        .then(({ data }) =>
          (data ?? []).map((t) => ({
            module: 'tasks' as const,
            id: t.id,
            title: t.title,
            subtitle: [t.status, t.due_date].filter(Boolean).join(' · ') || null,
          })),
        ),
    )
  }

  if (modules.includes('todos')) {
    searches.push(
      supabase
        .from('todos')
        .select('id, title, due_date')
        .or(ilikeAnyColumn(['title', 'notes'], keywords))
        .limit(RESULTS_PER_MODULE)
        .then(({ data }) =>
          (data ?? []).map((t) => ({
            module: 'todos' as const,
            id: t.id,
            title: t.title,
            subtitle: t.due_date ? `Due ${t.due_date}` : null,
          })),
        ),
    )
  }

  if (modules.includes('transactions')) {
    searches.push(
      supabase
        .from('transactions')
        .select('*')
        .or(ilikeAnyColumn(['category', 'description', 'merchant_name'], keywords))
        .limit(RESULTS_PER_MODULE)
        .then(({ data }) =>
          ((data ?? []) as Transaction[]).map((t) => ({
            module: 'transactions' as const,
            id: t.id,
            title: t.description || t.merchant_name || t.category,
            subtitle: `${t.type === 'income' ? '+' : '-'}${formatPounds(minorUnitsOf(t))} · ${t.date}`,
          })),
        ),
    )
  }

  if (modules.includes('habits')) {
    searches.push(
      supabase
        .from('daily_goal_habits')
        .select('id, name, description, widget')
        .or(ilikeAnyColumn(['name', 'description'], keywords))
        .limit(RESULTS_PER_MODULE)
        .then(({ data }) =>
          (data ?? []).map((h) => ({
            module: 'habits' as const,
            id: h.id,
            title: h.name,
            subtitle: h.widget === 'health' ? 'Health' : 'Habits',
          })),
        ),
    )
  }

  if (modules.includes('prompts')) {
    searches.push(
      supabase
        .from('prompts')
        .select('id, title')
        .or(ilikeAnyColumn(['title', 'prompt'], keywords))
        .limit(RESULTS_PER_MODULE)
        .then(({ data }) => (data ?? []).map((p) => ({ module: 'prompts' as const, id: p.id, title: p.title, subtitle: 'Prompt' }))),
    )
    searches.push(
      supabase
        .from('perplexity_links')
        .select('id, title, url')
        .or(ilikeAnyColumn(['title', 'url'], keywords))
        .limit(RESULTS_PER_MODULE)
        .then(({ data }) =>
          (data ?? []).map((l) => ({ module: 'prompts' as const, id: l.id, title: l.title, subtitle: l.url })),
        ),
    )
  }

  const results = await Promise.all(searches)
  return NextResponse.json({ results: results.flat() })
}
