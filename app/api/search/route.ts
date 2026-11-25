import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractSearchQuery } from '@/lib/search/nl-search'
import { SEARCH_MODULES } from '@/lib/search/local-query'
import { answerFromResults } from '@/lib/search/answer'
import { dueCountFact, transactionFacts, type FactTransaction } from '@/lib/search/facts'
import { resolveTimeWindow } from '@/lib/search/time-window'
import { isQuestion } from '@/lib/search/query-mode'
import { ilikeAnyColumn } from '@/lib/search/postgrest-filter'
import { rankCandidatesScored, type RankCandidate, type RankedItem } from '@/lib/search/rank'
import { formatPounds, minorUnitsOf } from '@/lib/money'
import type { Transaction } from '@/lib/types'
import type { SearchModule } from '@/lib/search/local-query'
import type { SearchResultItem } from '@/lib/search/types'

const RESULTS_PER_MODULE = 5
// Ask shows the answer model more rows than Find shows the user.
const ASK_RESULTS_PER_MODULE = 8
// Each table is asked for a wider, sensibly ordered pool; lib/search/rank.ts
// then picks the best RESULTS_PER_MODULE from it.
const CANDIDATES_PER_MODULE = 25
// Totals are summed in TypeScript over every matching transaction, not just
// the ranked few. Supabase's default max-rows is 1000, so hitting that also
// counts as capped even though we ask for more.
const TOTALS_ROW_LIMIT = 2000
const TOTALS_SERVER_CAP = 1000

// Finished task statuses — the education form's options are Not started /
// In progress / Submitted / Done (TaskFormModal.tsx); status is free text.
const FINISHED_TASK_STATUS = new Set(['done', 'submitted'])

// What is and isn't AI: the only AI in Find is the keyword/module
// extraction in lib/search/nl-search.ts, and that is skipped for short plain
// queries and falls back to local tokenising if it fails. Everything below —
// the ilike queries and the ranking — is plain hand-written TypeScript, no AI.
// The one exception is the Answer call at the bottom, which only runs in Ask
// mode (chosen by the query box, see lib/search/query-mode.ts). Capture mode
// never comes here — it goes to app/api/brain-dump/extract.

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = (await request.json()) as { query?: string; mode?: 'find' | 'ask' }
  const query = body.query?.trim()

  if (!query) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  // Older callers send no mode — fall back to the question heuristic.
  const wantsAnswer = body.mode ? body.mode === 'ask' : isQuestion(query)

  // Never throws: it falls back to local tokenising when the AI call fails.
  const { keywords, targetModules, timeWindow } = await extractSearchQuery(query)
  const now = new Date()
  const resolved = timeWindow ? resolveTimeWindow(timeWindow, now) : null

  // A bare module name (e.g. "todos") resolves locally with no keywords —
  // that's a browse-all, not "nothing to search for".
  // A window alone ("this week") is still a search: what's dated in it.
  if (keywords.length === 0 && targetModules.length === 0 && !resolved) {
    return NextResponse.json({ results: [], answer: null })
  }

  // With a window and no named module, only modules with a day column make sense.
  const modules: SearchModule[] =
    targetModules.length > 0 ? targetModules : resolved ? ['tasks', 'todos', 'transactions'] : SEARCH_MODULES
  const hasKeywords = keywords.length > 0
  const perModule = wantsAnswer ? ASK_RESULTS_PER_MODULE : RESULTS_PER_MODULE
  // Supabase's query builder is "thenable" rather than a full Promise —
  // PromiseLike is the type .then() on it actually produces. A failing table
  // (e.g. an unapplied migration) yields data = null, so it just contributes
  // nothing rather than breaking the whole search.
  const searches: PromiseLike<RankedItem[]>[] = []
  const factSearches: PromiseLike<string[]>[] = []
  const rank = (cands: RankCandidate[]) => rankCandidatesScored(cands, keywords, now, perModule)

  if (modules.includes('people')) {
    let q = supabase
      .from('people')
      .select('id, full_name, company, email, job_title, how_we_met, notes, updated_at')
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(CANDIDATES_PER_MODULE)
    if (hasKeywords) q = q.or(ilikeAnyColumn(['full_name', 'company', 'email', 'notes', 'job_title', 'how_we_met'], keywords))
    searches.push(
      q.then(({ data }) =>
        rank(
          (data ?? []).map((p) => ({
            item: { module: 'people' as const, id: p.id, title: p.full_name, subtitle: p.company ?? p.email ?? null },
            primary: p.full_name,
            secondary: [p.company, p.email, p.job_title, p.how_we_met, p.notes].filter((v): v is string => !!v),
            date: p.updated_at,
          })),
        ),
      ),
    )
  }

  if (modules.includes('tasks')) {
    let q = supabase
      .from('tasks')
      .select('id, title, status, due_date, notes, description, created_at')
      .order('due_date', { ascending: !!resolved, nullsFirst: false })
      .limit(CANDIDATES_PER_MODULE)
    if (resolved) q = q.gte('due_date', resolved.startDateKey).lt('due_date', resolved.endDateKey)
    if (hasKeywords) q = q.or(ilikeAnyColumn(['title', 'notes', 'description'], keywords))
    searches.push(
      q.then(({ data }) => {
        // data is null when the query failed: no count is better than a wrong "0 open".
        if (wantsAnswer && resolved && data) {
          const pool = data
          const open = pool.filter((t) => !FINISHED_TASK_STATUS.has((t.status ?? '').trim().toLowerCase())).length
          factSearches.push(Promise.resolve([dueCountFact('task', open, keywords, resolved, pool.length >= CANDIDATES_PER_MODULE)]))
        }
        return rank(
          (data ?? []).map((t) => ({
            item: {
              module: 'tasks' as const,
              id: t.id,
              title: t.title,
              subtitle: [t.status, t.due_date].filter(Boolean).join(' · ') || null,
            },
            primary: t.title,
            secondary: [t.notes, t.description].filter((v): v is string => !!v),
            date: t.due_date ?? t.created_at,
            inactive: FINISHED_TASK_STATUS.has((t.status ?? '').trim().toLowerCase()),
          })),
        )
      }),
    )
  }

  if (modules.includes('todos')) {
    let q = supabase
      .from('todos')
      .select('id, title, notes, due_date, completed_at, created_at')
      .order(resolved ? 'due_date' : 'created_at', { ascending: !!resolved })
      .limit(CANDIDATES_PER_MODULE)
    if (resolved) q = q.gte('due_date', resolved.startDateKey).lt('due_date', resolved.endDateKey)
    if (hasKeywords) q = q.or(ilikeAnyColumn(['title', 'notes'], keywords))
    searches.push(
      q.then(({ data }) => {
        if (wantsAnswer && resolved && data) {
          const pool = data
          const open = pool.filter((t) => !t.completed_at).length
          factSearches.push(Promise.resolve([dueCountFact('todo', open, keywords, resolved, pool.length >= CANDIDATES_PER_MODULE)]))
        }
        return rank(
          (data ?? []).map((t) => {
            const done = !!t.completed_at
            const due = t.due_date ? `Due ${t.due_date}` : null
            return {
              item: {
                module: 'todos' as const,
                id: t.id,
                title: t.title,
                subtitle: done ? ['Done', due].filter(Boolean).join(' · ') : due,
              },
              primary: t.title,
              secondary: t.notes ? [t.notes] : [],
              date: t.due_date ?? t.created_at,
              inactive: done,
            }
          }),
        )
      }),
    )
  }

  if (modules.includes('transactions')) {
    let q = supabase
      .from('transactions')
      .select('id, date, amount, amount_minor_units, category, description, merchant_name, type')
      .order('date', { ascending: false })
      .limit(CANDIDATES_PER_MODULE)
    if (resolved) q = q.gte('date', resolved.startDateKey).lt('date', resolved.endDateKey)
    if (hasKeywords) q = q.or(ilikeAnyColumn(['category', 'description', 'merchant_name'], keywords))
    if (wantsAnswer && (resolved || hasKeywords)) {
      // Same filters, but every matching row and only the columns the sums need.
      let totalsQ = supabase
        .from('transactions')
        .select('amount, amount_minor_units, type, date, source, starling_status:raw->>status')
        .limit(TOTALS_ROW_LIMIT)
      if (resolved) totalsQ = totalsQ.gte('date', resolved.startDateKey).lt('date', resolved.endDateKey)
      if (hasKeywords) totalsQ = totalsQ.or(ilikeAnyColumn(['category', 'description', 'merchant_name'], keywords))
      factSearches.push(
        totalsQ.then(({ data }) => {
          // A failed totals query must not become the "fact" that nothing was
          // spent — and the model must not add up the few rows it can see.
          if (!data) return ['A spending total could not be computed, so do not give one or add up the results.']
          const rows = (data as unknown as (FactTransaction & { starling_status: string | null })[]).map((r) => ({
            ...r,
            raw: r.starling_status ? { status: r.starling_status } : null,
          }))
          return transactionFacts(rows, keywords, resolved, rows.length >= TOTALS_SERVER_CAP)
        }),
      )
    }
    searches.push(
      q.then(({ data }) =>
        rank(
          ((data ?? []) as Transaction[]).map((t) => {
            const title = t.description || t.merchant_name || t.category
            return {
              item: {
                module: 'transactions' as const,
                id: t.id,
                title,
                subtitle: `${t.type === 'income' ? '+' : '-'}${formatPounds(minorUnitsOf(t))} · ${t.date}`,
              },
              primary: title,
              secondary: [t.description, t.merchant_name, t.category].filter((v): v is string => !!v),
              date: t.date,
            }
          }),
        ),
      ),
    )
  }

  if (modules.includes('habits')) {
    let q = supabase
      .from('daily_goal_habits')
      .select('id, name, description, widget, is_active, created_at')
      .order('sort_order', { ascending: true })
      .limit(CANDIDATES_PER_MODULE)
    if (hasKeywords) q = q.or(ilikeAnyColumn(['name', 'description'], keywords))
    searches.push(
      q.then(({ data }) =>
        rank(
          (data ?? []).map((h) => ({
            item: {
              module: 'habits' as const,
              id: h.id,
              title: h.name,
              subtitle: h.widget === 'health' ? 'Health' : 'Habits',
            },
            primary: h.name,
            secondary: h.description ? [h.description] : [],
            date: h.created_at,
            inactive: h.is_active === false,
          })),
        ),
      ),
    )
  }

  if (modules.includes('prompts')) {
    let promptsQ = supabase
      .from('prompts')
      .select('id, title, prompt, created_at')
      .order('created_at', { ascending: false })
      .limit(CANDIDATES_PER_MODULE)
    if (hasKeywords) promptsQ = promptsQ.or(ilikeAnyColumn(['title', 'prompt'], keywords))
    searches.push(
      promptsQ.then(({ data }) =>
        rank(
          (data ?? []).map((p) => ({
            item: { module: 'prompts' as const, id: p.id, title: p.title, subtitle: 'Prompt' },
            primary: p.title,
            secondary: p.prompt ? [p.prompt] : [],
            date: p.created_at,
          })),
        ),
      ),
    )

    let linksQ = supabase
      .from('perplexity_links')
      .select('id, title, url, created_at')
      .order('created_at', { ascending: false })
      .limit(CANDIDATES_PER_MODULE)
    if (hasKeywords) linksQ = linksQ.or(ilikeAnyColumn(['title', 'url'], keywords))
    searches.push(
      linksQ.then(({ data }) =>
        rank(
          (data ?? []).map((l) => ({
            item: { module: 'prompts' as const, id: l.id, title: l.title, subtitle: l.url },
            primary: l.title,
            secondary: l.url ? [l.url] : [],
            date: l.created_at,
          })),
        ),
      ),
    )
  }

  // Each module is already capped at RESULTS_PER_MODULE; order the combined
  // list so the strongest matches lead (stable sort keeps module order on ties).
  const results: SearchResultItem[] = (await Promise.all(searches))
    .flat()
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item)

  // Ask mode only — never a plain keyword search or browse-all, since
  // results entering the prompt makes this the pricier call.
  const facts = wantsAnswer ? (await Promise.all(factSearches)).flat() : []
  const answer = wantsAnswer ? await answerFromResults(query, results, { now, window: resolved, facts }) : null

  return NextResponse.json({ results, answer })
}
