// USD per 1M tokens, from ai.google.dev pricing at time of writing. Kept as
// the one place a model's price lives so ai_usage.est_cost_usd stays honest
// when models change.
export const PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  'gemini-3.5-flash-lite': { input: 0.3, output: 2.5 },
  'gemini-3.5-flash': { input: 1.5, output: 9.0 },
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING_PER_MILLION_TOKENS[model]
  if (!price) return 0
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}
