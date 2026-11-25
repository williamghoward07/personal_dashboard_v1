import { describe, expect, it } from 'vitest'
import { cleanText, safeClip, stripNul } from './text'

describe('stripNul', () => {
  it('removes every NUL', () => {
    expect(stripNul('a\u0000b\u0000')).toBe('ab')
  })
})

describe('safeClip', () => {
  it('cuts at max but never inside a surrogate pair', () => {
    expect(safeClip('abc', 5)).toBe('abc')
    expect(safeClip('ab\ud83d\ude00', 3)).toBe('ab')
    expect(safeClip('ab\ud83d\ude00', 4)).toBe('ab\ud83d\ude00')
    expect(safeClip('x'.repeat(19_999) + '\ud83d\ude00', 20_000)).toHaveLength(19_999)
  })
})

describe('cleanText', () => {
  it('strips NUL, replaces lone surrogates and clips safely', () => {
    expect(cleanText('a\u0000b\ud800c')).toBe('ab\ufffdc')
    expect(cleanText('ab\ud83d\ude00', 3)).toBe('ab')
  })
})
