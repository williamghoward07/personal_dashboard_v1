import 'server-only'
import { GoogleGenAI, Type, type Schema } from '@google/genai'
import type { AiSchema } from './schema'
import { assertUnderDailyBudget, recordUsage, AiDisabledError } from './usage'

export type Tier = 'fast' | 'smart'

// Two tiers, one key (see CLAUDE.md, Tech stack).
// fast: cheap extraction (search keywords, quick-add parsing). smart:
// judgement calls worth paying more for (answers over your own data,
// transaction categorisation, essay breakdowns).
const MODELS: Record<Tier, string> = {
  fast: 'gemini-3.5-flash-lite',
  smart: 'gemini-3.5-flash',
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

// The one narrow entry point every AI feature in this app calls through —
// every call site imports only this function, never the provider SDK
// directly. If the provider ever switches (e.g. to Claude), this is the
// only file that changes.
export async function generateStructured<T>({
  prompt,
  schema,
  feature,
  tier = 'fast',
  maxOutputTokens = 150,
  thinking = false,
}: {
  prompt: string
  schema: AiSchema
  // Short slug identifying the call site ('search', 'people_quick_add', …)
  // — stored on ai_usage so the AI Usage widget can break spend down by
  // feature.
  feature: string
  tier?: Tier
  maxOutputTokens?: number
  // Gemini 3.x bills reasoning tokens at the output rate — pure waste for
  // extraction, so thinking stays off unless a caller explicitly opts in
  // for a judgement task worth paying more for.
  thinking?: boolean
}): Promise<T> {
  if (process.env.AI_ENABLED === 'false') throw new AiDisabledError()
  await assertUnderDailyBudget()

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

  await recordUsage({
    feature,
    tier,
    model,
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  }).catch((err) => console.error('AI usage recording failed:', err))

  const text = response.text
  if (!text) {
    throw new Error('Gemini returned an empty response')
  }

  return JSON.parse(text) as T
}
