'use client'

import type { BrainDumpActFields, BrainDumpExtractResult, LocalDraft } from './types'

export interface DraftStoreState {
  text: string
  loading: boolean
  error: string | null
  drafts: LocalDraft[]
  lastExtractedText?: string
  confirming: string | null
}

export interface DraftStore {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => DraftStoreState
  setText: (text: string) => void
  setError: (error: string | null) => void
  runConfirmation: (target: string, save: () => Promise<void>) => Promise<void>
  setDraftStatus: (clientId: string, status: LocalDraft['status']) => void
  updateDraftAct: (clientId: string, patch: Partial<BrainDumpActFields>) => void
  /** Drops accepted/dismissed drafts. */
  clearFinished: () => void
  stop: () => void
  /** Extracts drafts from `rawText`. Resolves true when drafts were added. */
  submit: (rawText: string) => Promise<boolean>
}

// Module-scope, not component state, so an extraction in flight (and its
// result) survives navigating away from and back to the page — the fetch
// keeps running in the background regardless; before this, its result
// landed in component state that had been unmounted and thrown away.
// One store per surface (Brain Dump page, home query box) so their
// drafts never mix.
export function createDraftStore({ keepTextOnSuccess = false } = {}): DraftStore {
  let state: DraftStoreState = { text: '', loading: false, error: null, drafts: [], confirming: null }
  let abortController: AbortController | null = null
  let nextId = 0
  const listeners = new Set<() => void>()

  const setState = (patch: Partial<DraftStoreState>) => {
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener())
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => state,
    setText: (text) => setState(!text.trim() ? { text, lastExtractedText: undefined } : { text }),
    setError: (error) => setState({ error }),
    async runConfirmation(target, save) {
      if (state.confirming !== null) return
      if (target !== 'all' && !state.drafts.some((draft) => draft.clientId === target && draft.status === 'pending')) return
      // The lock outlives a list that unmounts while its write is in flight.
      setState({ confirming: target, error: null })
      try {
        await save()
      } finally {
        setState({ confirming: null })
      }
    },
    setDraftStatus(clientId, status) {
      setState({ drafts: state.drafts.map((d) => (d.clientId === clientId ? { ...d, status } : d)) })
    },
    updateDraftAct(clientId, patch) {
      setState({
        drafts: state.drafts.map((draft) => draft.clientId === clientId && draft.act
          ? { ...draft, act: { ...draft.act, ...patch } }
          : draft),
      })
    },
    clearFinished() {
      setState({ drafts: state.drafts.filter((d) => d.status === 'pending'), error: null })
    },
    stop() {
      abortController?.abort()
    },
    async submit(rawText) {
      const trimmed = rawText.trim()
      if (!trimmed || state.loading || trimmed === state.lastExtractedText) return false

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
          return false
        }

        const result = (await res.json()) as BrainDumpExtractResult
        if (result.drafts.length === 0) {
          setState({ error: "Didn't find anything to add in that." })
          return false
        }

        const newDrafts: LocalDraft[] = result.drafts.map((d) => ({
          ...d,
          clientId: `${Date.now()}-${nextId++}`,
          status: 'pending',
        }))
        setState({
          drafts: [...newDrafts, ...state.drafts],
          ...(keepTextOnSuccess ? { lastExtractedText: trimmed } : { text: '' }),
        })
        return true
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return false
        setState({ error: "Couldn't reach the AI service — try again in a moment." })
        return false
      } finally {
        setState({ loading: false })
        abortController = null
      }
    },
  }
}

export const brainDumpStore = createDraftStore({ keepTextOnSuccess: true })
export const captureStore = createDraftStore()
