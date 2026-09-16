'use client'

import type { BrainDumpActFields, BrainDumpExtractResult, LocalDraft } from './types'

export interface DraftStoreState {
  text: string
  loading: boolean
  error: string | null
  drafts: LocalDraft[]
}

export interface DraftStore {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => DraftStoreState
  setText: (text: string) => void
  setError: (error: string | null) => void
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
export function createDraftStore(): DraftStore {
  let state: DraftStoreState = { text: '', loading: false, error: null, drafts: [] }
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
    setText: (text) => setState({ text }),
    setError: (error) => setState({ error }),
    setDraftStatus(clientId, status) {
      setState({ drafts: state.drafts.map((d) => (d.clientId === clientId ? { ...d, status } : d)) })
    },
    updateDraftAct(clientId, patch) {
      setState({
        drafts: state.drafts.map((d) => (d.clientId === clientId && d.act ? { ...d, act: { ...d.act, ...patch } } : d)),
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
      if (!trimmed || state.loading) return false

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
        setState({ drafts: [...newDrafts, ...state.drafts], text: '' })
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

export const brainDumpStore = createDraftStore()
export const captureStore = createDraftStore()
