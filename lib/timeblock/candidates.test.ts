import { describe, expect, it } from 'vitest'
import { buildCandidateItems } from './candidates'

describe('buildCandidateItems', () => {
  it('tags todos and education tasks with their source and preserves id/title', () => {
    const result = buildCandidateItems(
      [{ id: 't1', title: 'Write essay' }],
      [{ id: 'e1', title: 'Problem set 3' }]
    )

    expect(result).toEqual([
      { id: 't1', source: 'todo', title: 'Write essay' },
      { id: 'e1', source: 'education_task', title: 'Problem set 3' },
    ])
  })

  it('handles empty inputs', () => {
    expect(buildCandidateItems([], [])).toEqual([])
  })
})
