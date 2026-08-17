import 'server-only'
import { GoogleGenAI, Type, type Schema } from '@google/genai'
import type { AiSchema } from './schema'

// Stable (not preview) Flash-tier model, free-tier eligible — see
// ai.google.dev/gemini-api/docs/models for the current lineup if this
// ever needs bumping. Deliberately not the newest release at the time
// this was written (3.7 Flash, days old) — a few months of track record
// matters more than being on the bleeding edge for a personal app.
const MODEL = 'gemini-3.5-flash'

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

// The one narrow entry point every AI feature in this app calls through
// — People quick-add and NL search both only ever import this function,
// never the provider SDK directly. If the provider ever switches (e.g.
// to Claude), this is the only file that changes.
export async function generateStructured<T>({ prompt, schema }: { prompt: string; schema: AiSchema }): Promise<T> {
  const ai = getClient()

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(schema),
    },
  })

  const text = response.text
  if (!text) {
    throw new Error('Gemini returned an empty response')
  }

  return JSON.parse(text) as T
}
