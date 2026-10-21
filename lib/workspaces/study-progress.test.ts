import { describe, expect, it } from 'vitest'
import { studyProgressByWorkspace } from './study-progress'

describe('studyProgressByWorkspace', () => {
  it('rolls readings and minutes up per workspace', () => {
    const map = studyProgressByWorkspace(
      [
        { workspace_id: 'a', completed_at: 'x' },
        { workspace_id: 'a', completed_at: null },
      ],
      [
        { workspace_id: 'a', minutes: 30 },
        { workspace_id: 'b', minutes: 45 },
        { workspace_id: 'b', minutes: 15 },
      ]
    )
    expect(map.get('a')).toEqual({ readings: { done: 1, total: 2, percent: 50 }, minutesThisWeek: 30 })
    expect(map.get('b')).toEqual({ readings: { done: 0, total: 0, percent: 0 }, minutesThisWeek: 60 })
    expect(map.has('c')).toBe(false)
  })
})
