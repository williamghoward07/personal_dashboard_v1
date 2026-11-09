import type { BbFetch, BbSnapshot, SnapshotProgress, SnapshotSummary } from '@/lib/blackboard/client'

/** fetch with the Blackboard session cookie. Used by the service worker and the content script. */
export const browserFetch: BbFetch = async (url) => {
  const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } })
  const type = res.headers.get('content-type') ?? ''
  const body: unknown = type.includes('json') ? await res.json().catch(() => null) : null
  return { status: res.status, url: res.url, body }
}

/**
 * How Blackboard was reached. `worker` = the service worker's own requests
 * carried the cookie. `tab` = it had to go through an open Blackboard tab.
 * Phase 1 exists largely to find out which one works.
 */
export type SyncVia = 'worker' | 'tab'

export type LastRun =
  | { at: string; ok: true; via: SyncVia; summary: SnapshotSummary; workerError?: string }
  | { at: string; ok: false; loginRequired: boolean; error: string; stage?: SyncState['stage'] }

/**
 * The sync in progress, in chrome.storage.session so the side panel can pick
 * it up whenever it opens. `stage: 'saving'` follows the snapshot's own stages.
 */
export interface SyncState {
  running: true
  startedAt: string
  /** ms epoch of the last progress write; a stale value means the worker died mid-sync. */
  updatedAt: number
  via: SyncVia
  stage: SnapshotProgress['stage'] | 'saving'
  progress?: SnapshotProgress
  /** Carried forward once known, so later steps can still say "10 courses". */
  courseCount?: number
}

/** Older than this with no progress = the worker was stopped, so the run is abandoned. */
export const SYNC_STALE_MS = 60_000

export type SessionCheck =
  | { status: 'connected'; via: SyncVia; userName: string }
  | { status: 'login'; reason: string }
  | { status: 'error'; error: string }

/** Side panel → service worker. */
export type WorkerMessage =
  | { type: 'sync' }
  | { type: 'check' }
  /** Content script → worker, while it runs a snapshot for the tab fallback. */
  | { type: 'progress'; progress: SnapshotProgress }

/** Service worker → content script. */
export type ContentMessage = { type: 'bb-snapshot' } | { type: 'bb-check' }

export type ContentReply =
  | { ok: true; snapshot: BbSnapshot }
  | { ok: false; loginRequired: boolean; error: string }

export type ContentCheckReply =
  | { ok: true; userName: string }
  | { ok: false; loginRequired: boolean; error: string }

export const STORAGE = {
  lastRun: 'lastRun',
  lastSnapshot: 'lastSnapshot',
  /** Summary of the last successful sync; survives later failed runs. */
  lastSummary: 'lastSummary',
  syncState: 'syncState',
  session: 'sessionCheck',
  theme: 'theme',
} as const

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
