// When an automatic sync may start. Pure, so the rules are tested without
// Chrome; background.ts reads the timestamps from chrome.storage.local.

export type SyncTrigger = 'manual' | 'daily' | 'visit'

export const DAILY_ALARM = 'daily-sync'
export const DAILY_PERIOD_MINUTES = 24 * 60
const HOUR = 3_600_000
const DAY = 24 * HOUR

/** A daily alarm is skipped when a successful sync finished this recently. */
export const DAILY_SKIP_MS = 20 * HOUR
/** Visiting Blackboard starts a sync only when none was attempted this recently. */
export const VISIT_GAP_MS = 6 * HOUR
/** A `syncStartedAt` older than this is a run whose worker died; it no longer blocks. */
export const SYNC_LOCK_STALE_MS = 10 * 60_000
/** After an automatic run that ended login-needed, a visit may retry once this has passed (the user has probably just logged in). */
export const VISIT_RETRY_AFTER_LOGIN_MS = 10 * 60_000
/** First alarm after install or browser start: never sooner than this. */
const FIRST_ALARM_MIN_DELAY_MS = 60_000

/** Timestamps (ms epoch) kept in chrome.storage.local. */
export interface TriggerClock {
  /** Set when a sync starts, removed when it ends. Survives a worker restart. */
  syncStartedAt?: number
  /** Last time any sync started, whatever happened. */
  lastAttemptAt?: number
  /** True when the last automatic run ended because Blackboard needed a login. */
  lastAttemptLoginNeeded?: boolean
  /** Last time Blackboard was read and (when a dashboard is set up) the upload was saved. */
  lastSuccessAt?: number
}

export function isSyncLocked(clock: TriggerClock, now: number): boolean {
  return clock.syncStartedAt != null && now - clock.syncStartedAt < SYNC_LOCK_STALE_MS
}

export function shouldRunDaily(clock: TriggerClock, now: number): boolean {
  return clock.lastSuccessAt == null || now - clock.lastSuccessAt >= DAILY_SKIP_MS
}

export function shouldRunVisit(clock: TriggerClock, now: number): boolean {
  if (clock.lastAttemptAt == null) return true
  const gap = clock.lastAttemptLoginNeeded ? VISIT_RETRY_AFTER_LOGIN_MS : VISIT_GAP_MS
  return now - clock.lastAttemptAt >= gap
}

/**
 * When to create the daily alarm (on install or browser start, if Chrome
 * dropped it). A day after the last success, but soon if that has passed:
 * a fixed 24 h delay would never fire for a browser that is closed nightly.
 */
export function firstDailyAlarmAt(clock: TriggerClock, now: number): number {
  const due = clock.lastSuccessAt == null ? now : clock.lastSuccessAt + DAY
  return Math.max(now + FIRST_ALARM_MIN_DELAY_MS, due)
}

/** When the daily alarm will actually sync: alarm times that fall inside the 20 h skip are passed over. */
export function nextDailySync(scheduledTime: number, clock: TriggerClock): number {
  let next = scheduledTime
  while (clock.lastSuccessAt != null && next - clock.lastSuccessAt < DAILY_SKIP_MS) next += DAY
  return next
}
