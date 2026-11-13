import type { BbFetch, BbSnapshot, SnapshotProgress, SnapshotSummary } from '@/lib/blackboard/client'
import type { DocumentsResult } from './documents'
import type { SyncTrigger } from './triggers'
import type { UploadBytes } from './upload'

export type { DocumentsResult, SyncTrigger, UploadBytes }

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

/**
 * Where synced snapshots go. Entered once in the side panel. `url` is the
 * dashboard's origin; Chrome grants the extension that one origin
 * (optional_host_permissions) when it's saved.
 */
export interface DashboardConfig {
  url: string
  token: string
}

/** The dashboard's reply to POST /api/blackboard/sync. Absent = no dashboard set up. */
export type UploadResult =
  | { ok: true; counts: Record<string, unknown>; bytes?: UploadBytes }
  | { ok: false; error: string; bytes?: UploadBytes }

/**
 * The latest run, whatever started it. `trigger` is missing on runs from
 * before 0.4.0 (they were all manual). Only counts and file names are kept:
 * never file bytes or extracted text.
 */
export type LastRun =
  | {
      at: string
      ok: true
      trigger?: SyncTrigger
      via: SyncVia
      summary: SnapshotSummary
      workerError?: string
      upload?: UploadResult
      /** Handbooks / briefs read after the upload; absent when none were asked for. */
      documents?: DocumentsResult
    }
  | { at: string; ok: false; trigger?: SyncTrigger; loginRequired: boolean; error: string; stage?: SyncState['stage'] }

/** The last daily or on-visit run, for the panel's "Last automatic sync" line. */
export interface LastAutoRun {
  at: string
  trigger: Exclude<SyncTrigger, 'manual'>
  outcome: 'saved' | 'read' | 'not-saved' | 'login' | 'error'
}

/**
 * The sync in progress, in chrome.storage.session so the side panel can pick
 * it up whenever it opens. `stage: 'saving'` follows the snapshot's own stages.
 */
export interface SyncState {
  running: true
  trigger?: SyncTrigger
  startedAt: string
  /** ms epoch of the last progress write; a stale value means the worker died mid-sync. */
  updatedAt: number
  via: SyncVia
  stage: SnapshotProgress['stage'] | 'saving' | 'documents'
  progress?: SnapshotProgress
  /** During `documents`: content items done / asked for. */
  documents?: { done: number; total: number }
  /** Carried forward once known, so later steps can still say "10 courses". */
  courseCount?: number
}

/** Older than this with no progress = the worker was stopped, so the run is abandoned. */
export const SYNC_STALE_MS = 60_000

export type SessionCheck =
  | { status: 'connected'; via: SyncVia; userName: string }
  | { status: 'login'; reason: string }
  | { status: 'error'; error: string }

/** Side panel → service worker. `sync` replies with the run, or undefined when one is already running. */
export type WorkerMessage =
  | { type: 'sync' }
  | { type: 'check' }
  /** Content script → worker, once per Blackboard page load. */
  | { type: 'visit' }
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
  dashboard: 'dashboard',
  /** TriggerClock fields (triggers.ts), one key each, ms epoch. */
  syncStartedAt: 'syncStartedAt',
  lastAttemptAt: 'lastAttemptAt',
  lastSuccessAt: 'lastSuccessAt',
  lastAutoRun: 'lastAutoRun',
  /** Documents this extension gave up reading (attachment id -> version, reason). Never bytes or text. */
  documentsTried: 'documentsTried',
} as const

export const SYNC_PATH = '/api/blackboard/sync'

/**
 * The origin to send syncs to, from what was typed. HTTPS only, except
 * localhost for development. Null when it isn't a usable URL.
 */
export function dashboardOrigin(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) return null
  return url.origin
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
