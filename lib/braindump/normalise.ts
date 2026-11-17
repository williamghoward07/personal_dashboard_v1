import type { NlExtractedInteraction, NlExtractedPerson, NlPersonMatch } from '@/lib/people/nl-extract'
import type { BrainDumpActFields, BrainDumpDraft, BrainDumpDraftKind, BrainDumpExtractResult } from './types'

const KINDS: readonly BrainDumpDraftKind[] = [
  'todo',
  'education_task',
  'calendar_event',
  'new_person',
  'update_person',
  'log_interaction',
]
const CHANNELS = ['in_person', 'call', 'video', 'message', 'email', 'other']
const MAX_DRAFTS = 30

type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t : null
}

/** A real calendar day — rejects 2026-02-30. */
export function validDate(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  const ok = date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
  return ok ? v.trim() : null
}

export function validTime(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null
}

function normaliseAct(raw: unknown, kind: BrainDumpDraftKind): BrainDumpActFields | null {
  if (!isObj(raw)) return null
  const title = str(raw.title)
  if (!title) return null
  return {
    title,
    due_date: validDate(raw.due_date),
    // Education tasks have no time column.
    due_time: kind === 'education_task' ? null : validTime(raw.due_time),
    notes: str(raw.notes),
  }
}

function normaliseMatch(raw: unknown, candidateIds: readonly string[]): NlPersonMatch | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !candidateIds.includes(raw.id)) return null
  if (typeof raw.confidence !== 'number' || !Number.isFinite(raw.confidence)) return null
  return { id: raw.id, confidence: Math.min(1, Math.max(0, raw.confidence)) }
}

function normalisePerson(raw: Obj): NlExtractedPerson {
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map(str).filter((t): t is string => t !== null)
    : null
  return {
    full_name: str(raw.full_name),
    email: str(raw.email),
    phone: str(raw.phone),
    company: str(raw.company),
    job_title: str(raw.job_title),
    how_we_met: str(raw.how_we_met),
    notes: str(raw.notes),
    tags: tags && tags.length ? tags : null,
  }
}

function normaliseInteraction(raw: unknown): NlExtractedInteraction | null {
  if (!isObj(raw)) return null
  const summary = str(raw.summary)
  if (!summary) return null
  const occurred = str(raw.occurred_at)
  const channel = typeof raw.channel === 'string' && CHANNELS.includes(raw.channel) ? raw.channel : null
  return {
    summary,
    occurred_at: occurred && !Number.isNaN(Date.parse(occurred)) ? occurred : null,
    channel: channel as NlExtractedInteraction['channel'],
    follow_up: str(raw.follow_up),
  }
}

function normaliseDraft(raw: unknown, candidateIds: readonly string[]): BrainDumpDraft | null {
  if (!isObj(raw)) return null
  const kind = raw.kind as BrainDumpDraftKind
  if (!KINDS.includes(kind)) return null
  const draft: BrainDumpDraft = { kind, act: null, person_match: null, person: null, interaction: null }

  if (kind === 'todo' || kind === 'education_task' || kind === 'calendar_event') {
    draft.act = normaliseAct(raw.act, kind)
    if (!draft.act) return null
  } else if (kind === 'new_person') {
    if (!isObj(raw.person)) return null
    draft.person = normalisePerson(raw.person)
    if (!draft.person.full_name) return null
  } else if (kind === 'update_person') {
    if (!isObj(raw.person)) return null
    draft.person = normalisePerson(raw.person)
    draft.person_match = normaliseMatch(raw.person_match, candidateIds)
  } else {
    draft.interaction = normaliseInteraction(raw.interaction)
    if (!draft.interaction) return null
    draft.person_match = normaliseMatch(raw.person_match, candidateIds)
  }
  return draft
}

function dedupeKey(d: BrainDumpDraft): string {
  const text = d.act?.title ?? d.person?.full_name ?? d.interaction?.summary ?? ''
  const date = d.act?.due_date ?? d.interaction?.occurred_at ?? ''
  return `${d.kind}|${text.toLowerCase()}|${date}`
}

/** Cleans untrusted model JSON into drafts the UI can safely render. */
export function normaliseDrafts(result: unknown, candidateIds: readonly string[]): BrainDumpExtractResult {
  if (!isObj(result) || !Array.isArray(result.drafts)) return { drafts: [] }
  const seen = new Set<string>()
  const drafts: BrainDumpDraft[] = []
  for (const raw of result.drafts) {
    const draft = normaliseDraft(raw, candidateIds)
    if (!draft) continue
    const key = dedupeKey(draft)
    if (seen.has(key)) continue
    seen.add(key)
    drafts.push(draft)
    if (drafts.length >= MAX_DRAFTS) break
  }
  return { drafts }
}
