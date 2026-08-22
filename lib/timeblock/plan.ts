import { computeFreeGaps } from './gaps'
import { placeItemsIntoGaps } from './placement'
import { shuffleItems } from './shuffle'
import type { BusyInterval, MinuteInterval, PlacementResult, TimeBlockCandidateItem } from './types'

export interface BuildTimeBlockPlanInput {
  window: MinuteInterval
  busyIntervals: BusyInterval[]
  candidates: TimeBlockCandidateItem[]
  durationMinutes: number
  // Test seam only — production callers omit this and get Math.random.
  rng?: () => number
}

// The single entry point the wizard calls: shuffle candidates into random
// order, compute today's free gaps, then greedily pack the shuffled items
// into them. See shuffleItems/computeFreeGaps/placeItemsIntoGaps for the
// individual steps.
export function buildTimeBlockPlan(input: BuildTimeBlockPlanInput): PlacementResult {
  const shuffled = shuffleItems(input.candidates, input.rng)
  const gaps = computeFreeGaps(input.window, input.busyIntervals)
  return placeItemsIntoGaps(gaps, shuffled, input.durationMinutes)
}
