// Shared helpers for the Blackboard AI prompts and their output validation.
// Pure: no server-only, Next or Supabase imports.

import { cleanText } from '@/lib/blackboard/text'

export const SESSION_TYPES = ['lecture', 'tutorial', 'practical', 'workshop', 'seminar', 'fieldwork', 'test', 'other'] as const
export type SessionType = (typeof SESSION_TYPES)[number]

// C0/C1 control characters except tab, newline and form feed (page breaks).
const CONTROL = /[\u0000-\u0008\u000b\u000d-\u001f\u007f-\u009f]/g

/**
 * Model output → a plain one-line string of at most `max` characters, or
 * null. Strips control characters, collapses whitespace, never throws.
 */
export function cleanModelString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = cleanText(value.replace(CONTROL, ' '))
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  return cleanText(text, max).trim()
}

/** An integer in [min, max], else null. Accepts integral numbers and numeric strings. */
export function clampInt(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'string' && /^\s*\d+\s*$/.test(value) ? Number(value) : value
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) return null
  return n
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  return (allowed as readonly string[]).includes(v) ? (v as T) : null
}

/**
 * Source text for a prompt: no control characters (bar newline / tab / page
 * break), no NUL or lone surrogates, and no sequence that could fake the
 * prompt's block delimiters. Grounding checks quotes against this exact
 * text, so the prompt and the check always see the same characters.
 */
export function cleanSourceText(text: string | null | undefined): string {
  if (!text) return ''
  return cleanText(text.replace(CONTROL, ' '))
    .replace(/<{3,}/g, '‹‹')
    .replace(/>{3,}/g, '››')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/** One line for a prompt: whitespace collapsed, at most `max` characters. */
export function promptLine(text: string | null | undefined, max: number): string {
  return cleanText(cleanSourceText(text).replace(/\s+/g, ' '), max).trim()
}

/** The JSON object a model call returned, or null. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/**
 * The model answered, but not with anything usable (wrong shape). Like a
 * truncated or unparseable reply, it is a failure of this batch, never
 * "nothing found".
 */
export class AiOutputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiOutputError'
  }
}
