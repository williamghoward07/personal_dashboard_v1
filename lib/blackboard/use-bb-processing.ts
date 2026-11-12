'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { notifyWorkChanged } from './events'

// Drives POST /api/work/process while the dashboard is open: one unit per
// call, 500 ms apart, until nothing is left, the Blackboard AI budget is
// used up, AI is disabled or a call fails. Pauses while the tab is hidden.
//
// The loop lives at module level, not in a component, so React's
// double-mount (and several components using the hook) can't start two
// loops. A localStorage lock (refreshed every call, stale after 2 minutes)
// stops two tabs processing at once. Never throws into render.

export type BbProcessingState = 'idle' | 'running' | 'done' | 'budget' | 'disabled' | 'error'

export interface BbProcessingTotals {
  /** Rows processed across this run's calls. */
  processed: number
  /** Unchanged rows skipped, as of the latest call (not summed). */
  unchanged: number
  /** Key dates added across this run's calls. */
  added: number
}

export interface BbProcessing {
  state: BbProcessingState
  totals: BbProcessingTotals
  remaining: number
  error: string | null
  run: () => void
}

/** The JSON the route answers with (lib/blackboard/ai/process.ts ProcessResult, or disabled). */
interface ProcessResponse {
  disabled?: boolean
  processed?: number
  skippedUnchanged?: number
  added?: number
  updated?: number
  removed?: number
  remaining?: number
  budgetHit?: boolean
  error?: string
}

const ENDPOINT = '/api/work/process'
const DELAY_MS = 500
const LOCK_KEY = 'bb-processing-lock'
const LOCK_TTL_MS = 2 * 60_000

interface Snapshot {
  state: BbProcessingState
  totals: BbProcessingTotals
  remaining: number
  error: string | null
}

const INITIAL: Snapshot = { state: 'idle', totals: { processed: 0, unchanged: 0, added: 0 }, remaining: 0, error: null }

let snapshot: Snapshot = INITIAL
let looping = false
let autoStarted = false
const listeners = new Set<() => void>()
const tabId = Math.random().toString(36).slice(2)

function set(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch }
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// ------------------------------------------------------------------ lock --

function readLock(): { tab: string; at: number } | null {
  try {
    const raw = window.localStorage.getItem(LOCK_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { tab?: unknown; at?: unknown }
    return typeof parsed.tab === 'string' && typeof parsed.at === 'number' ? { tab: parsed.tab, at: parsed.at } : null
  } catch {
    return null
  }
}

/** Takes or refreshes the lock; false when another tab holds a fresh one. */
function takeLock(): boolean {
  try {
    const lock = readLock()
    if (lock && lock.tab !== tabId && Date.now() - lock.at < LOCK_TTL_MS) return false
    window.localStorage.setItem(LOCK_KEY, JSON.stringify({ tab: tabId, at: Date.now() }))
    return true
  } catch {
    // No storage (private mode …): run without the cross-tab guard.
    return true
  }
}

function releaseLock() {
  try {
    if (readLock()?.tab === tabId) window.localStorage.removeItem(LOCK_KEY)
  } catch {
    // ignore
  }
}

// ------------------------------------------------------------------ loop --

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function whenVisible(): Promise<void> {
  if (document.visibilityState !== 'hidden') return Promise.resolve()
  return new Promise((resolve) => {
    const onChange = () => {
      if (document.visibilityState === 'hidden') return
      document.removeEventListener('visibilitychange', onChange)
      resolve()
    }
    document.addEventListener('visibilitychange', onChange)
  })
}

async function callOnce(): Promise<ProcessResponse> {
  const res = await fetch(ENDPOINT, { method: 'POST' })
  let body: ProcessResponse | null = null
  try {
    body = (await res.json()) as ProcessResponse
  } catch {
    body = null
  }
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Not signed in' : (body?.error ?? `Processing failed (${res.status})`))
  }
  return body ?? {}
}

async function loop() {
  if (looping) return
  if (!takeLock()) return
  looping = true
  set({ state: 'running', error: null, totals: { processed: 0, unchanged: 0, added: 0 } })
  try {
    for (;;) {
      await whenVisible()
      if (!takeLock()) {
        // Another tab took over after this one was hidden for 2+ minutes.
        set({ state: 'idle' })
        return
      }
      const r = await callOnce()
      if (r.disabled) {
        set({ state: 'disabled', remaining: 0 })
        return
      }
      const totals = {
        processed: snapshot.totals.processed + (r.processed ?? 0),
        unchanged: r.skippedUnchanged ?? snapshot.totals.unchanged,
        added: snapshot.totals.added + (r.added ?? 0),
      }
      set({ totals, remaining: r.remaining ?? 0 })
      if ((r.added ?? 0) + (r.updated ?? 0) + (r.removed ?? 0) > 0) notifyWorkChanged()
      if (r.error) {
        set({ state: 'error', error: r.error })
        return
      }
      if (r.budgetHit) {
        set({ state: 'budget' })
        return
      }
      if (!r.remaining) {
        set({ state: 'done' })
        return
      }
      await sleep(DELAY_MS)
    }
  } catch (err) {
    set({ state: 'error', error: err instanceof Error ? err.message : 'Processing failed' })
  } finally {
    looping = false
    releaseLock()
  }
}

function start() {
  void loop().catch(() => {
    // loop() handles its own errors; this only guards against the impossible.
  })
}

/**
 * Blackboard AI processing status. With `auto`, one loop starts per page
 * load (the first component asking for it starts it); `run()` starts
 * another on demand unless one is already going.
 */
export function useBbProcessing({ auto }: { auto: boolean }): BbProcessing {
  const current = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => INITIAL
  )

  useEffect(() => {
    if (!auto || autoStarted) return
    autoStarted = true
    start()
  }, [auto])

  const run = useCallback(() => start(), [])

  return { ...current, run }
}
