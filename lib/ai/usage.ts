import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { londonDayBoundsUTC } from '@/lib/google/london-day'
import { estimateCostUsd } from './pricing'
import { BB_FEATURE_PREFIX, budgetFor } from './constants'
import { AiBudgetExceededError, AiDisabledError, type AiLedger, type AiUsageEntry, type Tier } from './gemini'

export { AiBudgetExceededError, AiDisabledError }

type SessionClient = Awaited<ReturnType<typeof createClient>>

// `_` is a LIKE wildcard, so this also matches any feature starting "bb"
// plus one character. No non-Blackboard feature starts with "bb".
const BB_LIKE = `${BB_FEATURE_PREFIX}%`

/**
 * Today's (London day) ai_usage rows that count against `feature`'s budget:
 * bb_* features count only bb_* rows, every other feature counts only the
 * non-bb_* rows. Null on a read error.
 */
export async function callsToday(feature: string, supabase?: SessionClient): Promise<number | null> {
  const db = supabase ?? (await createClient())
  const today = londonDayBoundsUTC().startDateKey
  const base = db.from('ai_usage').select('id', { count: 'exact', head: true }).eq('day', today)
  const query = budgetFor(feature).scope === 'bb' ? base.like('feature', BB_LIKE) : base.not('feature', 'like', BB_LIKE)
  const { count, error } = await query
  if (error) return null
  return count ?? 0
}

/** Calls left today in `feature`'s budget (the cap when usage can't be read). */
export async function remainingCallsToday(feature: string, supabase?: SessionClient): Promise<number> {
  const used = await callsToday(feature, supabase)
  return Math.max(0, budgetFor(feature).cap - (used ?? 0))
}

export async function assertUnderDailyBudget(feature = ''): Promise<void> {
  const used = await callsToday(feature)
  // Fail open on a tracking read error — usage accounting shouldn't take
  // down a working feature.
  if (used === null) return
  if (used >= budgetFor(feature).cap) throw new AiBudgetExceededError()
}

/**
 * Appends one ai_usage row. Thinking tokens are billed at the output rate,
 * so they count in est_cost_usd; the input_tokens / output_tokens columns
 * stay as the model reported them (output excludes thinking).
 */
export async function recordUsage({
  feature,
  tier,
  model,
  inputTokens,
  outputTokens,
  thoughtTokens = 0,
}: {
  feature: string
  tier: Tier
  model: string
  inputTokens: number
  outputTokens: number
  /** Thinking tokens of the call (lib/ai/gemini.ts StructuredResult.thoughtTokens). */
  thoughtTokens?: number
}): Promise<void> {
  const supabase = await createClient()
  await supabase.from('ai_usage').insert({
    feature,
    tier,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    est_cost_usd: estimateCostUsd(model, inputTokens, outputTokens + Math.max(0, thoughtTokens)),
  })
}

/** The default ledger of generateStructured: the signed-in session's ai_usage rows. */
export const sessionLedger: AiLedger = {
  assertUnderBudget: (feature: string) => assertUnderDailyBudget(feature),
  record: (entry: AiUsageEntry) => recordUsage(entry),
}
