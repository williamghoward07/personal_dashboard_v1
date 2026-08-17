// Provider-agnostic structured-output schema — a small subset of JSON
// Schema, not Gemini's own Schema/Type format. Every AI call site in this
// app builds one of these, and lib/ai/gemini.ts is the only place that
// translates it into whatever shape the actual provider wants. Swapping
// providers later (e.g. to Claude) means rewriting gemini.ts, not every
// call site's schema definitions.
export type AiSchemaType = 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array'

export interface AiSchema {
  type: AiSchemaType
  description?: string
  nullable?: boolean
  enum?: string[]
  properties?: Record<string, AiSchema>
  required?: string[]
  items?: AiSchema
}
