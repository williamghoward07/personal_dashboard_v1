// Shared between server (lib/ai/usage.ts) and client (the AI Usage widget)
// code — kept out of usage.ts itself since that file is 'server-only'.

/** Daily calls for everything except Blackboard processing (search, capture, people, brain dump …). */
export const DAILY_CALL_CAP = 200

/**
 * Daily calls for Blackboard processing (every feature key starting `bb_`).
 * A separate budget, so a first full Blackboard run can't starve search or
 * capture, and they can't starve it. bb_* calls never count towards
 * DAILY_CALL_CAP.
 */
export const BB_DAILY_CALL_CAP = 80

export const BB_FEATURE_PREFIX = 'bb_'

/** Feature keys for ai_usage rows written by Blackboard processing. */
export const BB_FEATURES = {
  classify: 'bb_classify',
  extractAnnouncement: 'bb_extract_announcement',
  extractContent: 'bb_extract_content',
  extractDocument: 'bb_extract_document',
  eval: 'bb_eval',
} as const

export function isBlackboardFeature(feature: string): boolean {
  return feature.startsWith(BB_FEATURE_PREFIX)
}

/** Which daily budget a feature's calls count against. */
export function budgetFor(feature: string): { scope: 'bb' | 'shared'; cap: number } {
  return isBlackboardFeature(feature) ? { scope: 'bb', cap: BB_DAILY_CALL_CAP } : { scope: 'shared', cap: DAILY_CALL_CAP }
}
