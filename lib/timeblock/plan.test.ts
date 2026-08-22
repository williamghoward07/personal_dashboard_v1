import { describe, expect, it } from 'vitest'
import { buildTimeBlockPlan } from './plan'
import type { TimeBlockCandidateItem } from './types'

// Deterministic sequence generator for reproducible shuffle assertions —
// not a real PRNG, just a fixed queue of values in [0,1).
function seededRng(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

describe('buildTimeBlockPlan', () => {
  it('composes shuffle -> gaps -> placement end to end against a small fixture day', () => {
    const candidates: TimeBlockCandidateItem[] = [
      { id: 'a', source: 'todo', title: 'Todo A' },
      { id: 'b', source: 'education_task', title: 'Task B' },
      { id: 'c', source: 'todo', title: 'Todo C' },
    ]

    const result = buildTimeBlockPlan({
      window: { startMinutes: 0, endMinutes: 100 },
      busyIntervals: [{ id: 'busy-1', title: 'Lecture', startMinutes: 40, endMinutes: 100 }],
      candidates,
      durationMinutes: 20,
      rng: seededRng([0]), // identity order with this shuffle implementation
    })

    // Only the 0-40 gap is free (40 minutes), so exactly two 20-minute
    // blocks fit and one candidate is left unplaced.
    expect(result.placed).toHaveLength(2)
    expect(result.unplaced).toHaveLength(1)
    for (const block of result.placed) {
      expect(block.endMinutes).toBeLessThanOrEqual(40)
    }
  })

  it('is deterministic for a given rng', () => {
    const candidates: TimeBlockCandidateItem[] = [
      { id: 'a', source: 'todo', title: 'A' },
      { id: 'b', source: 'todo', title: 'B' },
    ]
    const buildInput = () => ({
      window: { startMinutes: 0, endMinutes: 200 },
      busyIntervals: [],
      candidates,
      durationMinutes: 30,
      rng: seededRng([0.9, 0.1]), // fresh closure per call — a shared one would advance across both invocations
    })

    expect(buildTimeBlockPlan(buildInput())).toEqual(buildTimeBlockPlan(buildInput()))
  })
})
