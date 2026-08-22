'use client'

import type { LocalDraft } from '@/app/components/widgets/braindump/DraftCard'
import type { BrainDumpExtractResult } from './extract'

interface BrainDumpState {
  text: string
  loading: boolean
  error: string | null
  drafts: LocalDraft[]
}

// Module-scope, not component state, so an extraction in flight (and its
// result) survives navigating away from and back to the Brain Dump page —
// the fetch already keeps running in the background regardless; the bug
// was that its result landed in component state that had been unmounted
// and thrown away. Living here means the next mount just reads whatever
// the request already produced.
let state: BrainDumpState = {
  text: '',
  loading: false,
  error: null,
  drafts: [],
}

let abortController: AbortController | null = null
const listeners = new Set<() => void>()

function setState(patch: Partial<BrainDumpState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

export function subscribeBrainDump(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getBrainDumpSnapshot() {
  return state
}

export function setBrainDumpText(text: string) {
  setState({ text })
}

export function setBrainDumpError(error: string | null) {
  setState({ error })
}

export function setBrainDumpDraftStatus(clientId: string, status: LocalDraft['status']) {
  setState({ drafts: state.drafts.map((d) => (d.clientId === clientId ? { ...d, status } : d)) })
}

export function stopBrainDumpExtraction() {
  abortController?.abort()
}

export async function submitBrainDump(rawText: string) {
  const trimmed = rawText.trim()
  if (!trimmed || state.loading) return

  const controller = new AbortController()
  abortController = controller
  setState({ loading: true, error: null })

  try {
    const res = await fetch('/api/brain-dump/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setState({ error: body?.error ?? "Couldn't read that — try rephrasing." })
      return
    }

    const result = (await res.json()) as BrainDumpExtractResult
    if (result.drafts.length === 0) {
      setState({ error: "Didn't find anything actionable in that." })
      return
    }

    const newDrafts: LocalDraft[] = result.drafts.map((d, i) => ({
      ...d,
      clientId: `${Date.now()}-${i}`,
      status: 'pending',
    }))
    setState({ drafts: [...newDrafts, ...state.drafts], text: '' })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    setState({ error: "Couldn't reach the AI service — try again in a moment." })
  } finally {
    setState({ loading: false })
    abortController = null
  }
}
