import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { londonDayBoundsUTC } from '@/lib/google/london-day'
import { estimateCostUsd } from './pricing'
import { DAILY_CALL_CAP } from './constants'
import type { Tier } from './gemini'

export class AiDisabledError extends Error {
  constructor() {
    super('AI features are disabled.')
    this.name = 'AiDisabledError'
  }
}

export class AiBudgetExceededError extends Error {
  constructor() {
    super('AI budget reached for today.')
    this.name = 'AiBudgetExceededError'
  }
}

export async function assertUnderDailyBudget(): Promise<void> {
  const supabase = await createClient()
  const today = londonDayBoundsUTC().startDateKey
  const { count, error } = await supabase.from('ai_usage').select('id', { count: 'exact', head: true }).eq('day', today)

  // Fail open on a tracking read error — usage accounting shouldn't take
  // down a working feature.
  if (error) return
  if ((count ?? 0) >= DAILY_CALL_CAP) throw new AiBudgetExceededError()
}

export async function recordUsage({
  feature,
  tier,
  model,
  inputTokens,
  outputTokens,
}: {
  feature: string
  tier: Tier
  model: string
  inputTokens: number
  outputTokens: number
}): Promise<void> {
  const supabase = await createClient()
  await supabase.from('ai_usage').insert({
    feature,
    tier,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    est_cost_usd: estimateCostUsd(model, inputTokens, outputTokens),
  })
}
