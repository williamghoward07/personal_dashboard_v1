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

/**
 * Where synced snapshots go. Entered once in the side panel. `url` is the
 * dashboard's origin; Chrome grants the extension that one origin
 * (optional_host_permissions) when it's saved.
 */
export interface DashboardConfig {
  url: string
  token: string
}

/**
 * Two saved dashboards: Live (the production site) and Test (localhost or a
 * preview URL). Each keeps its own address and token; `active` is the one
 * syncs go to.
 */
export type TargetId = 'live' | 'test'

export interface DashboardTargets {
  active: TargetId
  live?: DashboardConfig
  test?: DashboardConfig
}

export const TARGET_LABEL: Record<TargetId, string> = { live: 'Live', test: 'Test' }

/**
 * Reads the stored targets. Installs from before Live/Test have one
 * `dashboard` entry, which becomes Live.
 */
export function readTargets(stored: Record<string, unknown>): DashboardTargets {
  const targets = stored[STORAGE.dashboards] as DashboardTargets | undefined
  if (targets) return targets
  const legacy = stored[STORAGE.dashboard] as DashboardConfig | undefined
  return legacy?.url && legacy.token ? { active: 'live', live: legacy } : { active: 'live' }
}

/** The dashboard syncs go to right now, or undefined when the active one isn't set up. */
export function activeDashboard(targets: DashboardTargets): (DashboardConfig & { target: TargetId }) | undefined {
  const config = targets[targets.active]
  return config?.url && config.token ? { ...config, target: targets.active } : undefined
}

/** "localhost:3000" from "http://localhost:3000". */
export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * The dashboard's reply to POST /api/blackboard/sync, tagged with where it
 * went. Absent = no dashboard set up. `unreachable` = nothing answered (e.g.
 * the local dev server isn't running).
 */
export type UploadResult = { target: TargetId; host: string } & (
  | { ok: true; counts: Record<string, unknown> }
  | { ok: false; error: string; unreachable?: boolean }
)

export type LastRun =
  | { at: string; ok: true; via: SyncVia; summary: SnapshotSummary; workerError?: string; upload?: UploadResult }
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
  /** Pre-Live/Test single dashboard. Read once by readTargets, then removed. */
  dashboard: 'dashboard',
  dashboards: 'dashboards',
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
