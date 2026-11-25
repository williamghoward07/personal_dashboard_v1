// One model call for a classify or extract batch, end to end: prompt →
// model → validation → grounding. Shared by process.ts (the app) and
// scripts/bb-eval.ts, so the eval measures exactly what the app runs. The
// model call is injected. Pure: no server-only, Next or Supabase imports.

import type { AiSchema } from '@/lib/ai/schema'
import { BB_FEATURES } from '@/lib/ai/constants'
import { buildClassifyPrompt, CLASSIFY_SCHEMA, parseClassifyResult, type Classification, type ClassifyContext, type ClassifyRow } from './classify'
import { buildExtractPrompt, EXTRACT_SCHEMA, parseExtractResult, type ExtractContext, type ExtractSource } from './extract'
import {
  groundItems,
  keyDateFingerprint,
  linkToAssignment,
  toDueAt,
  validDueDate,
  type AssignmentLite,
  type FoundKeyDate,
  type KeyDateSourceKind,
} from './grounding'

export interface AiRequest {
  prompt: string
  schema: AiSchema
  feature: string
  tier: 'fast' | 'smart'
  maxOutputTokens: number
  thinking: boolean
}

/** The model call (lib/ai/gemini.ts in the app and the eval, a fake in tests). */
export type AiCall = (request: AiRequest) => Promise<{ data: unknown; model: string }>

export const CLASSIFY_MAX_OUTPUT_TOKENS = 4096

// Extraction runs on the smart tier with thinking on, and lib/ai/gemini.ts
// sends no thinkingBudget then (the model's dynamic default). Gemini counts
// thinking tokens against maxOutputTokens, so the cap must hold the largest
// dynamic thinking budget PLUS the JSON answer, or a full batch can be cut
// off mid-JSON. Only tokens actually used are billed, so a high cap costs
// nothing by itself.
/** The flash models' largest dynamic thinking budget. */
export const EXTRACT_THINKING_CEILING = 24_576
/**
 * Room for the answer: an item is at most ~150 tokens (80-character title,
 * 300-character quote, the other fields and JSON), so this holds 50+ items,
 * more than a 12,000-character call can sensibly contain.
 */
export const EXTRACT_ANSWER_TOKENS = 8192
export const EXTRACT_MAX_OUTPUT_TOKENS = EXTRACT_THINKING_CEILING + EXTRACT_ANSWER_TOKENS

export const EXTRACT_FEATURE: Record<KeyDateSourceKind, string> = {
  announcement: BB_FEATURES.extractAnnouncement,
  content: BB_FEATURES.extractContent,
  document: BB_FEATURES.extractDocument,
}

export async function runClassifyBatch(
  batch: ClassifyRow[],
  ctx: ClassifyContext,
  ai: AiCall,
  feature: string = BB_FEATURES.classify
): Promise<{ rows: Classification[]; model: string }> {
  const { data, model } = await ai({
    prompt: buildClassifyPrompt(batch, ctx),
    schema: CLASSIFY_SCHEMA,
    feature,
    tier: 'fast',
    maxOutputTokens: CLASSIFY_MAX_OUTPUT_TOKENS,
    thinking: false,
  })
  return { rows: parseClassifyResult(batch, data, ctx.window), model }
}

export interface ExtractBatchResult {
  /** Grounded key dates per source, aligned with the batch. */
  perSource: FoundKeyDate[][]
  /** Items the model returned. */
  returned: number
  /** Dropped: quote not in its own source, or no date in the quote. */
  ungrounded: number
  /** Dropped: the quote states a different date than the item. */
  dateMismatch: number
  /** Dropped: only a relative date, in a source with no posted day. */
  noAnchor: number
  /** Dropped: malformed, impossible date, or outside the academic year. */
  invalid: number
  model: string
}

/**
 * `assignments` are the course's official assignments in the order
 * `ctx.assignments` lists them, so the model's `matches_assignment` index
 * resolves to an id.
 */
export async function runExtractBatch(
  batch: ExtractSource[],
  ctx: ExtractContext,
  assignments: AssignmentLite[],
  ai: AiCall,
  feature?: string
): Promise<ExtractBatchResult> {
  const { data, model } = await ai({
    prompt: buildExtractPrompt(batch, ctx),
    schema: EXTRACT_SCHEMA,
    feature: feature ?? EXTRACT_FEATURE[batch[0]?.kind ?? 'content'],
    tier: 'smart',
    maxOutputTokens: EXTRACT_MAX_OUTPUT_TOKENS,
    thinking: true,
  })
  const parsed = parseExtractResult(batch, data, assignments.length)
  // Only an announcement has a posted day that relative words ("next
  // week") can be resolved against; a content item's availability date
  // and a document are not anchors. Session days are checked against the
  // sessions this prompt listed, never a wider list.
  const grounded = groundItems(
    parsed.items,
    batch.map((s) => ({ title: s.title, text: s.text, anchor: s.kind === 'announcement' ? s.posted : null })),
    { yearStart: Number(ctx.window.from.slice(0, 4)), sessions: ctx.sessions ?? [] }
  )
  let invalid = parsed.invalid
  const perSource: FoundKeyDate[][] = batch.map(() => [])
  for (const item of grounded.kept) {
    if (!validDueDate(item.due_on, ctx.window)) {
      invalid++
      continue
    }
    const source = batch[item.source - 1]
    const found = {
      course_id: source.course_id,
      title: item.title,
      category: item.category,
      due_on: item.due_on,
      due_at: toDueAt(item.due_on, item.due_time),
      for_session_type: item.for_session_type,
      for_week: item.for_week,
      quote: item.quote,
      fingerprint: keyDateFingerprint({ course_id: source.course_id, due_on: item.due_on, title: item.title }),
    }
    perSource[item.source - 1].push({
      ...found,
      assignment_id: linkToAssignment({ ...found, matches_assignment: item.matches_assignment }, assignments),
    })
  }
  return {
    perSource,
    returned: parsed.items.length + parsed.invalid,
    ungrounded: grounded.ungrounded,
    dateMismatch: grounded.dateMismatch,
    noAnchor: grounded.noAnchor,
    invalid,
    model,
  }
}
