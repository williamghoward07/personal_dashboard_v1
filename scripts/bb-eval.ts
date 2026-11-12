/**
 * Blackboard AI eval: runs the REAL prompts, schemas and grounding from
 * lib/blackboard/ai/ against Gemini, through lib/ai/gemini.ts (the same model
 * call the app makes), on hand-labelled fixtures, and checks the quality bar
 * before the UI relies on it. Run by a human; it makes real (paid) calls.
 *
 *   npm run bb:eval -- [--env .env.local] [--fixtures tmp/bb-eval]
 *
 * That runs this file with jiti (already in node_modules), aliasing `@/` to
 * the repo root and `server-only` to its empty module, so lib/ai/gemini.ts
 * keeps its `import 'server-only'` guard and still loads outside Next.
 *
 * Env: loads `.env.local` from the cwd (or the --env path) without
 * overriding variables already set; values are never printed. Needs
 * GEMINI_API_KEY. When NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * and BLACKBOARD_OWNER_USER_ID are all set, every call is logged to ai_usage
 * as feature `bb_eval` for that user and counts against the Blackboard daily
 * budget (BB_DAILY_CALL_CAP); otherwise usage is only printed.
 *
 * Fixtures: every `*.json` in the fixtures folder (gitignored `tmp/`), one
 * course per file:
 *
 * {
 *   "name": "GEOG1061 sample",                       // optional
 *   "course": { "module_code": "GEOG1061", "name": "Geographies of Border Crises", "term": "2026" },
 *   "today": "2026-11-12",                            // optional, default: today (London)
 *   "assignments": [                                  // the course's official bb_assignments
 *     { "id": "as-1", "title": "Summative Essay", "due_at": "2027-02-16T14:00:00Z" }
 *   ],
 *   "sources": [
 *     {
 *       "id": "ann-1",                                // any unique string
 *       "kind": "announcement",                      // announcement | content | document
 *       "title": "Reading for the tutorials next week",
 *       "text": "Please read chapter 2 before Tuesday's tutorial.",
 *       "posted": "2026-11-10",                      // optional (announcement posted / item available)
 *       "expected_key_dates": [{ "due_on": "2026-11-17", "category": "tutorial" }]
 *     },
 *     {
 *       "id": "ct-1",
 *       "kind": "content",
 *       "content_kind": "document",                  // bb_content.kind, default "document"
 *       "path": ["Week 12: Introduction Lecture"],
 *       "title": "Lecture 1 - Mon 5th Oct 2026, 10am, ER201",
 *       "text": "",
 *       "links": [{ "href": "https://…/L1.pptx", "label": "Lecture 1", "kind": "slides" }],
 *       "expected_key_dates": [],
 *       "expected_class": { "role": "slides", "week": 12, "explicit_date": "2026-10-05",
 *                           "session_type": "lecture", "lecture_ordinal": 1 }
 *     },
 *     { "id": "doc-1", "kind": "document", "title": "Handbook.pdf",
 *       "text": "page one … \f page two …",          // pages separated by \f
 *       "expected_key_dates": [{ "due_on": "2027-02-16", "category": "summative" }] }
 *   ]
 * }
 *
 * `expected_key_dates` lists everything the source really holds (an empty
 * list means "nothing", e.g. a dated lecture title). In `expected_class`,
 * only the keys present are scored.
 *
 * A key-date hit = same source, same due_on, same category. Exits non-zero
 * below: recall ≥ 0.9 for summative / formative / test, ≥ 0.75 for
 * tutorial / session_task, zero ungrounded items surviving, role accuracy
 * ≥ 0.85.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { AiBudgetExceededError, generateStructuredWithUsage, type AiLedger } from '@/lib/ai/gemini'
import { BB_DAILY_CALL_CAP, BB_FEATURES } from '@/lib/ai/constants'
import { estimateCostUsd } from '@/lib/ai/pricing'
import { londonDayBoundsUTC } from '@/lib/google/london-day'
import { londonToday } from '@/lib/blackboard/dates'
import type { BbContentKind } from '@/lib/blackboard/normalise'
import type { BbContentLink, BbContentRole, BbKeyDateCategory } from '@/lib/blackboard/types'
import { planClassifyBatches, type Classification, type ClassifyRow } from '@/lib/blackboard/ai/classify'
import {
  ANNOUNCEMENT_LIMITS,
  chunkDocument,
  CONTENT_LIMITS,
  MAX_CALL_CHARS,
  MAX_DOCUMENT_CHUNKS,
  planExtractBatches,
  prepareSource,
  type ExtractContext,
  type ExtractSource,
} from '@/lib/blackboard/ai/extract'
import { academicWindow, mergeKeyDates, type AssignmentLite, type FoundKeyDate } from '@/lib/blackboard/ai/grounding'
import { runClassifyBatch, runExtractBatch, type AiCall } from '@/lib/blackboard/ai/pipeline'
import { hasDateSignal } from '@/lib/blackboard/ai/prefilter'

// ---------------------------------------------------------------- fixtures --

interface FixtureSource {
  id: string
  kind: 'announcement' | 'content' | 'document'
  title: string
  text?: string
  posted?: string | null
  path?: string[]
  content_kind?: BbContentKind
  links?: BbContentLink[]
  expected_key_dates?: { due_on: string; category: BbKeyDateCategory }[]
  expected_class?: {
    role?: BbContentRole
    week?: number | null
    explicit_date?: string | null
    session_type?: string | null
    lecture_ordinal?: number | null
  }
}

interface Fixture {
  name?: string
  course: { module_code: string; name?: string; term?: string }
  today?: string
  assignments?: { id?: string; title: string; due_at: string | null }[]
  sources: FixtureSource[]
}

// -------------------------------------------------------------------- args --

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}

function loadEnv(file: string): number {
  if (!fs.existsSync(file)) return 0
  let n = 0
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!m || line.trimStart().startsWith('#')) continue
    let value = m[2]
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, '')
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = value
      n++
    }
  }
  return n
}

// ------------------------------------------------------------------ ledger --

function makeLedger(): { ledger: AiLedger; logged: boolean } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const owner = process.env.BLACKBOARD_OWNER_USER_ID
  if (!url || !key || !owner) {
    return {
      logged: false,
      ledger: {
        async assertUnderBudget() {},
        async record(e) {
          console.log(`  usage (not logged): ${e.feature} ${e.model} in=${e.inputTokens} out=${e.outputTokens}`)
        },
      },
    }
  }
  // Service role, so user_id is set explicitly to the owner.
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return {
    logged: true,
    ledger: {
      async assertUnderBudget() {
        const { count, error } = await db
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', owner)
          .eq('day', londonDayBoundsUTC().startDateKey)
          .like('feature', 'bb_%')
        if (!error && (count ?? 0) >= BB_DAILY_CALL_CAP) throw new AiBudgetExceededError()
      },
      async record(e) {
        const { error } = await db.from('ai_usage').insert({
          user_id: owner,
          feature: e.feature,
          tier: e.tier,
          model: e.model,
          input_tokens: e.inputTokens,
          output_tokens: e.outputTokens,
          est_cost_usd: estimateCostUsd(e.model, e.inputTokens, e.outputTokens),
        })
        if (error) console.error(`  usage logging failed: ${error.message}`)
      },
    },
  }
}

// ----------------------------------------------------------------- scoring --

const ALL_CATEGORIES: BbKeyDateCategory[] = ['summative', 'formative', 'test', 'tutorial', 'session_task', 'other']
const RECALL_BAR: Partial<Record<BbKeyDateCategory, number>> = {
  summative: 0.9,
  formative: 0.9,
  test: 0.9,
  tutorial: 0.75,
  session_task: 0.75,
}
const ROLE_BAR = 0.85

interface Tally {
  tp: number
  fp: number
  fn: number
}

function ratio(a: number, b: number): number | null {
  return b === 0 ? null : a / b
}

function fmt(x: number | null): string {
  return x === null ? '  n/a' : x.toFixed(2).padStart(5)
}

/** Same typographic + whitespace normalisation as grounding, checked independently. */
function plain(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// -------------------------------------------------------------------- main --

async function main() {
  const envFile = path.resolve(arg('--env') ?? '.env.local')
  const loaded = loadEnv(envFile)
  if (loaded) console.log(`Loaded ${loaded} variables from ${envFile} (values not shown).`)

  const dir = path.resolve(arg('--fixtures') ?? 'tmp/bb-eval')
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : []
  if (files.length === 0) {
    console.log(`No fixtures in ${dir}.`)
    console.log('Create the folder and add one JSON file per course; the shape is documented at the top of scripts/bb-eval.ts.')
    console.log('  mkdir -p tmp/bb-eval   (tmp/ is gitignored)')
    process.exit(0)
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set (put it in .env.local or pass --env).')
    process.exit(2)
  }

  const { ledger, logged } = makeLedger()
  console.log(logged ? 'Usage is logged to ai_usage as bb_eval for BLACKBOARD_OWNER_USER_ID.' : 'Usage is printed only (no Supabase service env).')

  let calls = 0
  let inputTokens = 0
  let outputTokens = 0
  let costUsd = 0
  const ai: AiCall = async (request) => {
    calls++
    const r = await generateStructuredWithUsage<unknown>({ ...request, feature: BB_FEATURES.eval, ledger })
    inputTokens += r.inputTokens
    outputTokens += r.outputTokens + r.thoughtTokens
    costUsd += estimateCostUsd(r.model, r.inputTokens, r.outputTokens + r.thoughtTokens)
    return { data: r.data, model: r.model }
  }

  const tallies = new Map<BbKeyDateCategory, Tally>(ALL_CATEGORIES.map((c) => [c, { tp: 0, fp: 0, fn: 0 }]))
  let returned = 0
  let ungrounded = 0
  let invalid = 0
  let survivingUngrounded = 0
  const cls = { role: [0, 0], week: [0, 0], date: [0, 0], session: [0, 0], ordinal: [0, 0] }
  const misses: string[] = []

  for (const file of files) {
    const fx = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as Fixture
    console.log(`\n== ${fx.name ?? file} (${fx.sources.length} sources)`)
    const courseId = `eval:${fx.course.module_code}`
    const today = fx.today ?? londonToday(new Date())
    const window = academicWindow(fx.course.term ?? null, today)
    const assignments: AssignmentLite[] = (fx.assignments ?? [])
      .map((a, i) => ({ id: a.id ?? `as-${i + 1}`, course_id: courseId, title: a.title, due_at: a.due_at }))
      .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'))
    const ctx: ExtractContext = {
      today,
      window,
      moduleCode: fx.course.module_code,
      courseName: fx.course.name ?? null,
      assignments: assignments.map((a) => ({ title: a.title, due_at: a.due_at })),
    }

    // ---- classification
    const contentRows: ClassifyRow[] = fx.sources
      .filter((s) => s.kind === 'content')
      .map((s) => ({
        id: s.id,
        course_id: courseId,
        kind: s.content_kind ?? 'document',
        title: s.title,
        path: s.path ?? [],
        body_text: s.text ?? null,
        links: s.links ?? [],
        body_hash: s.id,
      }))
    const classified = new Map<string, Classification>()
    for (const batch of planClassifyBatches(contentRows)) {
      const { rows } = await runClassifyBatch(batch, { moduleCode: fx.course.module_code, courseName: fx.course.name ?? null, window }, ai)
      for (const r of rows) classified.set(r.content_id, r)
    }
    for (const s of fx.sources) {
      const want = s.expected_class
      const got = classified.get(s.id)
      if (!want || !got) continue
      const score = (key: keyof typeof cls, expected: unknown, actual: unknown, label: string) => {
        cls[key][1]++
        if (expected === actual) cls[key][0]++
        else misses.push(`  ${s.id} ${label}: expected ${String(expected)}, got ${String(actual)}`)
      }
      if (want.role !== undefined) score('role', want.role, got.role, 'role')
      if ('week' in want) score('week', want.week ?? null, got.uni_week, 'week')
      if ('explicit_date' in want) score('date', want.explicit_date ?? null, got.explicit_date, 'explicit_date')
      if ('session_type' in want) score('session', want.session_type ?? null, got.session_type, 'session_type')
      if ('lecture_ordinal' in want) score('ordinal', want.lecture_ordinal ?? null, got.lecture_ordinal, 'lecture_ordinal')
    }

    // ---- extraction, exactly as the app batches it
    const toSource = (s: FixtureSource): ExtractSource => ({
      kind: s.kind,
      id: s.id,
      course_id: courseId,
      title: s.title,
      text: s.text ?? '',
      posted: s.posted ?? null,
      path: s.path,
    })
    const predicted = new Map<string, FoundKeyDate[]>()
    const groundTexts = new Map<string, string[]>()
    const add = (id: string, found: FoundKeyDate[], text: string) => {
      predicted.set(id, [...(predicted.get(id) ?? []), ...found])
      groundTexts.set(id, [...(groundTexts.get(id) ?? []), text])
    }
    const run = async (batch: ExtractSource[]) => {
      const r = await runExtractBatch(batch, ctx, assignments, ai)
      returned += r.returned
      ungrounded += r.ungrounded
      invalid += r.invalid
      batch.forEach((s, i) => add(s.id, r.perSource[i], `${s.title}\n${s.text}`))
    }
    const withSignal = (s: FixtureSource) => hasDateSignal(`${s.title}\n${s.text ?? ''}`)
    for (const batch of planExtractBatches(fx.sources.filter((s) => s.kind === 'announcement' && withSignal(s)).map(toSource), ANNOUNCEMENT_LIMITS)) {
      await run(batch)
    }
    for (const batch of planExtractBatches(fx.sources.filter((s) => s.kind === 'content' && withSignal(s)).map(toSource), CONTENT_LIMITS)) {
      await run(batch)
    }
    for (const doc of fx.sources.filter((s) => s.kind === 'document')) {
      const chunks = chunkDocument(doc.text ?? '', MAX_CALL_CHARS - 400)
      if (chunks.length > MAX_DOCUMENT_CHUNKS) console.log(`  ${doc.id}: only the first ${MAX_DOCUMENT_CHUNKS} of ${chunks.length} parts are read`)
      for (const c of chunks.slice(0, MAX_DOCUMENT_CHUNKS).filter((c) => hasDateSignal(c.text))) {
        await run([prepareSource({ ...toSource(doc), text: c.text, path: undefined, pages: { first: c.firstPage, last: c.lastPage } })])
      }
    }

    // ---- score key dates per source
    for (const s of fx.sources) {
      // The app's within-source dedupe (overlapping chunks, repeated mentions).
      const got = mergeKeyDates([], predicted.get(s.id) ?? [], { kind: s.kind, id: s.id }).insert
      const texts = (groundTexts.get(s.id) ?? []).map(plain)
      for (const g of got) {
        if (!texts.some((t) => t.includes(plain(g.quote)))) {
          survivingUngrounded++
          misses.push(`  ${s.id} UNGROUNDED survived: "${g.quote}"`)
        }
      }
      const open = [...got]
      for (const e of s.expected_key_dates ?? []) {
        const i = open.findIndex((g) => g.due_on === e.due_on && g.category === e.category)
        if (i >= 0) {
          tallies.get(e.category)!.tp++
          open.splice(i, 1)
        } else {
          tallies.get(e.category)!.fn++
          misses.push(`  ${s.id} missed ${e.category} ${e.due_on}`)
        }
      }
      for (const g of open) {
        tallies.get(g.category)!.fp++
        misses.push(`  ${s.id} extra ${g.category} ${g.due_on} "${g.title}"`)
      }
    }
  }

  // ---- report
  console.log('\nKey dates          recall  precision  (tp/fp/fn)')
  let failed = false
  for (const c of ALL_CATEGORIES) {
    const t = tallies.get(c)!
    const recall = ratio(t.tp, t.tp + t.fn)
    const bar = RECALL_BAR[c]
    const below = bar !== undefined && recall !== null && recall < bar
    if (below) failed = true
    console.log(
      `  ${c.padEnd(14)} ${fmt(recall)}   ${fmt(ratio(t.tp, t.tp + t.fp))}     ${t.tp}/${t.fp}/${t.fn}${bar !== undefined ? `  (bar ${bar})` : ''}${below ? '  FAIL' : ''}`
    )
  }
  console.log(`\nModel items returned: ${returned}; dropped ungrounded: ${ungrounded} (${fmt(ratio(ungrounded, returned))}); dropped invalid: ${invalid}`)
  console.log(`Ungrounded items surviving: ${survivingUngrounded}${survivingUngrounded ? '  FAIL' : ''}`)
  if (survivingUngrounded) failed = true

  const acc = (k: keyof typeof cls) => ratio(cls[k][0], cls[k][1])
  const roleAcc = acc('role')
  if (roleAcc !== null && roleAcc < ROLE_BAR) failed = true
  console.log('\nClassification     accuracy  (n)')
  console.log(`  role            ${fmt(roleAcc)}     (${cls.role[1]})  (bar ${ROLE_BAR})${roleAcc !== null && roleAcc < ROLE_BAR ? '  FAIL' : ''}`)
  console.log(`  week            ${fmt(acc('week'))}     (${cls.week[1]})`)
  console.log(`  explicit_date   ${fmt(acc('date'))}     (${cls.date[1]})`)
  console.log(`  session_type    ${fmt(acc('session'))}     (${cls.session[1]})`)
  console.log(`  lecture_ordinal ${fmt(acc('ordinal'))}     (${cls.ordinal[1]})`)

  console.log(`\nCalls: ${calls}; tokens in ${inputTokens}, out ${outputTokens} (incl. thinking); est. cost $${costUsd.toFixed(4)}`)
  if (misses.length) console.log(`\nDetails:\n${misses.join('\n')}`)
  console.log(failed ? '\nFAIL: below the quality bar.' : '\nPASS')
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  if (err instanceof AiBudgetExceededError) console.error('Stopped: the Blackboard AI budget for today is used up.')
  else console.error(err instanceof Error ? err.message : err)
  process.exit(2)
})
