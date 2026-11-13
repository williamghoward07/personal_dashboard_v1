import { describe, expect, it } from 'vitest'
import { firstDailyAlarmAt, isSyncLocked, nextDailySync, shouldRunDaily, shouldRunVisit } from './triggers'

const H = 3_600_000
const now = Date.UTC(2026, 10, 12, 9, 0)

describe('trigger rules', () => {
  it('locks while a sync started under 10 minutes ago', () => {
    expect(isSyncLocked({}, now)).toBe(false)
    expect(isSyncLocked({ syncStartedAt: now - 9 * 60_000 }, now)).toBe(true)
    expect(isSyncLocked({ syncStartedAt: now - 10 * 60_000 }, now)).toBe(false)
  })

  it('daily skips when a successful sync finished in the last 20 h', () => {
    expect(shouldRunDaily({}, now)).toBe(true)
    expect(shouldRunDaily({ lastSuccessAt: now - 19 * H }, now)).toBe(false)
    expect(shouldRunDaily({ lastSuccessAt: now - 20 * H }, now)).toBe(true)
    // A failed attempt doesn't count as success.
    expect(shouldRunDaily({ lastAttemptAt: now - H, lastSuccessAt: now - 30 * H }, now)).toBe(true)
  })

  it('visit runs only when nothing was attempted in the last 6 h', () => {
    expect(shouldRunVisit({}, now)).toBe(true)
    expect(shouldRunVisit({ lastAttemptAt: now - 5 * H }, now)).toBe(false)
    expect(shouldRunVisit({ lastAttemptAt: now - 6 * H }, now)).toBe(true)
  })

  it('visit retries 10 minutes after a run that ended login-needed, but waits 6 h after one that read Blackboard', () => {
    expect(shouldRunVisit({ lastAttemptAt: now - 5 * 60_000, lastAttemptLoginNeeded: true }, now)).toBe(false)
    expect(shouldRunVisit({ lastAttemptAt: now - 10 * 60_000, lastAttemptLoginNeeded: true }, now)).toBe(true)
    expect(shouldRunVisit({ lastAttemptAt: now - 30 * 60_000, lastAttemptLoginNeeded: false }, now)).toBe(false)
    expect(shouldRunVisit({ lastAttemptAt: now - 5 * H, lastSuccessAt: now - 5 * H }, now)).toBe(false)
  })

  it('schedules the first alarm a day after the last success, but at least a minute out', () => {
    expect(firstDailyAlarmAt({}, now)).toBe(now + 60_000)
    expect(firstDailyAlarmAt({ lastSuccessAt: now - 2 * H }, now)).toBe(now + 22 * H)
    expect(firstDailyAlarmAt({ lastSuccessAt: now - 48 * H }, now)).toBe(now + 60_000)
  })

  it('reports the next alarm that will really sync', () => {
    expect(nextDailySync(now + H, {})).toBe(now + H)
    // Synced 1 h ago: the alarm in 1 h is skipped, the one after runs.
    expect(nextDailySync(now + H, { lastSuccessAt: now - H })).toBe(now + 25 * H)
    expect(nextDailySync(now + H, { lastSuccessAt: now - 21 * H })).toBe(now + H)
  })
})
