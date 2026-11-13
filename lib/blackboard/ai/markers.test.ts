import { describe, expect, it } from 'vitest'
import { failMarker, hashState, isDone, partialMarker, retryMarker } from './markers'

const H = 'a3f1c2d4e5b60718293a4b5c6d7e8f90' // an md5
const H2 = '0f9e8d7c6b5a49382716051f2e3d4c5b'

describe('hashState', () => {
  it('reads plain hashes', () => {
    expect(hashState(null, H)).toEqual({ kind: 'pending' })
    expect(hashState(H, H)).toEqual({ kind: 'done' })
    expect(hashState(H2, H)).toEqual({ kind: 'pending' })
  })

  it('applies a marker only while it carries the current hash', () => {
    expect(hashState(retryMarker(H), H)).toEqual({ kind: 'retry' })
    expect(hashState(failMarker(H), H)).toEqual({ kind: 'failed' })
    expect(hashState(partialMarker(12, H), H)).toEqual({ kind: 'partial', next: 12 })
    // The text changed: the row is simply planned again.
    expect(hashState(retryMarker(H2), H)).toEqual({ kind: 'pending' })
    expect(hashState(failMarker(H2), H)).toEqual({ kind: 'pending' })
    expect(hashState(partialMarker(12, H2), H)).toEqual({ kind: 'pending' })
    expect(hashState('weird:thing', H)).toEqual({ kind: 'pending' })
  })

  it('never takes a marker for a real hash', () => {
    for (const m of [retryMarker(H), failMarker(H), partialMarker(3, H)]) {
      expect(m).not.toBe(H)
      expect(isDone(m, H)).toBe(false)
    }
    expect(isDone(H, H)).toBe(true)
  })
})
