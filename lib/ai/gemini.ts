import 'server-only'
import { GoogleGenAI, Type, type Schema } from '@google/genai'
import type { AiSchema } from './schema'

// Server-side only. scripts/bb-eval.ts (`npm run bb:eval`) calls the model
// through this exact code path from plain Node, with `server-only` aliased
// to its empty module. The app's default
// ledger (./usage, which reads the Next cookie session) is loaded lazily so
// the script never pulls in next/headers.

export type Tier = 'fast' | 'smart'

// Two tiers, one key (see CLAUDE.md, Tech stack).
// fast: cheap extraction (search keywords, quick-add parsing). smart:
// judgement calls worth paying more for (answers over your own data,
// transaction categorisation, essay breakdowns).
const MODELS: Record<Tier, string> = {
  fast: 'gemini-3.5-flash-lite',
  smart: 'gemini-3.5-flash',
}

export function modelFor(tier: Tier): string {
  return MODELS[tier]
}

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

export interface AiUsageEntry {
  feature: string
  tier: Tier
  model: string
  inputTokens: number
  outputTokens: number
  /** Thinking tokens: billed at the output rate, so they count towards est_cost_usd. */
  thoughtTokens?: number
}

/**
 * Budget check + usage log around every call. The app uses the session
 * ledger in ./usage (cookie Supabase client, RLS); a script passes its own.
 */
export interface AiLedger {
  /** Throws AiBudgetExceededError when the feature's daily budget is used up. */
  assertUnderBudget(feature: string): Promise<void>
  /** Appends one ai_usage row. */
  record(entry: AiUsageEntry): Promise<void>
}

export interface GenerateOptions {
  prompt: string
  schema: AiSchema
  // Short slug identifying the call site ('search', 'people_quick_add', …)
  // — stored on ai_usage so the AI Usage widget can break spend down by
  // feature. Keys starting `bb_` count against the Blackboard budget
  // (lib/ai/constants.ts).
  feature: string
  tier?: Tier
  maxOutputTokens?: number
  // Gemini 3.x bills reasoning tokens at the output rate — pure waste for
  // extraction, so thinking stays off unless a caller explicitly opts in
  // for a judgement task worth paying more for.
  thinking?: boolean
  /** Defaults to the signed-in session's ledger (lib/ai/usage.ts). */
  ledger?: AiLedger
}

export interface StructuredResult<T> {
  data: T
  model: string
  inputTokens: number
  outputTokens: number
  thoughtTokens: number
}

const TYPE_MAP: Record<AiSchema['type'], Type> = {
  object: Type.OBJECT,
  string: Type.STRING,
  number: Type.NUMBER,
  integer: Type.INTEGER,
  boolean: Type.BOOLEAN,
  array: Type.ARRAY,
}

function toGeminiSchema(schema: AiSchema): Schema {
  return {
    type: TYPE_MAP[schema.type],
    description: schema.description,
    nullable: schema.nullable,
    enum: schema.enum,
    required: schema.required,
    properties: schema.properties
      ? Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, toGeminiSchema(value)]))
      : undefined,
    items: schema.items ? toGeminiSchema(schema.items) : undefined,
  }
}

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')
    client = new GoogleGenAI({ apiKey })
  }
  return client
}

async function defaultLedger(): Promise<AiLedger> {
  const { sessionLedger } = await import('./usage')
  return sessionLedger
}

/**
 * generateStructured plus the model id and token counts, for callers that
 * store which model produced a row (Blackboard processing) or report cost
 * (the eval script).
 */
export async function generateStructuredWithUsage<T>({
  prompt,
  schema,
  feature,
  tier = 'fast',
  maxOutputTokens = 150,
  thinking = false,
  ledger,
}: GenerateOptions): Promise<StructuredResult<T>> {
  if (process.env.AI_ENABLED === 'false') throw new AiDisabledError()
  const usage = ledger ?? (await defaultLedger())
  await usage.assertUnderBudget(feature)

  const model = MODELS[tier]
  const ai = getClient()

  // gemini-3.5-flash-lite (the fast tier) rejects thinkingConfig outright —
  // 400 INVALID_ARGUMENT even for { thinkingBudget: 0 } — unlike the old
  // 2.5-flash-lite. It never reasons anyway, so there's nothing to turn
  // off; only send this to models that actually support it.
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(schema),
      maxOutputTokens,
      ...(tier === 'smart' ? { thinkingConfig: thinking ? undefined : { thinkingBudget: 0 } } : {}),
    },
  })

  const inputTokens = response.usageMetadata?.promptTokenCount ?? 0
  const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0
  // Billed at the output rate. The ledger adds them to est_cost_usd; the
  // input_tokens / output_tokens columns are logged exactly as before.
  const thoughtTokens = response.usageMetadata?.thoughtsTokenCount ?? 0

  await usage
    .record({ feature, tier, model, inputTokens, outputTokens, thoughtTokens })
    .catch((err) => console.error('AI usage recording failed:', err))

  const text = response.text
  if (!text) {
    throw new Error('Gemini returned an empty response')
  }

  return { data: JSON.parse(text) as T, model, inputTokens, outputTokens, thoughtTokens }
}

// The one narrow entry point every AI feature in this app calls through —
// every call site imports only this file, never the provider SDK
// directly. If the provider ever switches (e.g. to Claude), this is the
// only file that changes.
export async function generateStructured<T>(options: GenerateOptions): Promise<T> {
  return (await generateStructuredWithUsage<T>(options)).data
}
