import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractSearchQuery, isQuestion, SEARCH_MODULES, type SearchModule } from '@/lib/search/nl-search'
import { answerFromResults } from '@/lib/search/answer'
import { ilikeAnyColumn } from '@/lib/search/postgrest-filter'
import { formatPounds, minorUnitsOf } from '@/lib/money'
import type { Transaction } from '@/lib/types'
import type { SearchResultItem } from '@/lib/search/types'

const RESULTS_PER_MODULE = 5

// Everything below is plain TypeScript running hand-written ilike queries —
// no AI touches this part at all (see lib/search/nl-search.ts for the one
// call that does, which only ever returns keywords + module names, never
// SQL). The one exception is the optional Answer-mode call at the bottom,
// which only ever runs for a query that already reads as a question.
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

  // A bare module name (e.g. "todos") resolves locally with no keywords —
  // that's a browse-all, not "nothing to search for".
  if (keywords.length === 0 && targetModules.length === 0) {
    return NextResponse.json({ results: [] })
  }

  const modules = targetModules.length > 0 ? targetModules : SEARCH_MODULES
  const hasKeywords = keywords.length > 0
  // Supabase's query builder is "thenable" rather than a full Promise —
  // PromiseLike is the type .then() on it actually produces.
  const searches: PromiseLike<SearchResultItem[]>[] = []

  if (modules.includes('people')) {
    let q = supabase.from('people').select('id, full_name, company, email').limit(RESULTS_PER_MODULE)
    if (hasKeywords) q = q.or(ilikeAnyColumn(['full_name', 'company', 'email', 'notes'], keywords))
    searches.push(
      q.then(({ data }) =>
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
    let q = supabase.from('tasks').select('id, title, status, due_date').limit(RESULTS_PER_MODULE)
    if (hasKeywords) q = q.or(ilikeAnyColumn(['title', 'notes', 'description'], keywords))
    searches.push(
      q.then(({ data }) =>
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
    let q = supabase.from('todos').select('id, title, due_date').limit(RESULTS_PER_MODULE)
    if (hasKeywords) q = q.or(ilikeAnyColumn(['title', 'notes'], keywords))
    searches.push(
      q.then(({ data }) =>
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
    let q = supabase.from('transactions').select('*').limit(RESULTS_PER_MODULE)
    if (hasKeywords) q = q.or(ilikeAnyColumn(['category', 'description', 'merchant_name'], keywords))
    searches.push(
      q.then(({ data }) =>
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
    let q = supabase.from('daily_goal_habits').select('id, name, description, widget').limit(RESULTS_PER_MODULE)
    if (hasKeywords) q = q.or(ilikeAnyColumn(['name', 'description'], keywords))
    searches.push(
      q.then(({ data }) =>
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
    let promptsQ = supabase.from('prompts').select('id, title').limit(RESULTS_PER_MODULE)
    if (hasKeywords) promptsQ = promptsQ.or(ilikeAnyColumn(['title', 'prompt'], keywords))
    searches.push(
      promptsQ.then(({ data }) => (data ?? []).map((p) => ({ module: 'prompts' as const, id: p.id, title: p.title, subtitle: 'Prompt' }))),
    )

    let linksQ = supabase.from('perplexity_links').select('id, title, url').limit(RESULTS_PER_MODULE)
    if (hasKeywords) linksQ = linksQ.or(ilikeAnyColumn(['title', 'url'], keywords))
    searches.push(
      linksQ.then(({ data }) => (data ?? []).map((l) => ({ module: 'prompts' as const, id: l.id, title: l.title, subtitle: l.url }))),
    )
  }

  const results = (await Promise.all(searches)).flat()

  // Search mode 2 (Answer) — gated to questions only, never a plain
  // keyword search or browse-all, since results entering the prompt makes
  // this the pricier of the two extra calls a search can trigger.
  const answer = isQuestion(query) ? await answerFromResults(query, results) : null

  return NextResponse.json({ results, answer })
}
