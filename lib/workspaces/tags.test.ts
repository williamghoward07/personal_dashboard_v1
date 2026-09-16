import { describe, expect, it } from 'vitest'
import { extractHashtags, mergeTags, normalizeTag, tagSuggestions } from './tags'

describe('normalizeTag', () => {
  it('strips #, lowercases and hyphenates spaces', () => {
    expect(normalizeTag('#Pricing')).toBe('pricing')
    expect(normalizeTag('  Supplier Ideas ')).toBe('supplier-ideas')
    expect(normalizeTag('##café')).toBe('café')
  })

  it('drops punctuation', () => {
    expect(normalizeTag('drop.shipping!')).toBe('dropshipping')
  })

  it('rejects empty and numeric-only tags', () => {
    expect(normalizeTag('#')).toBeNull()
    expect(normalizeTag('   ')).toBeNull()
    expect(normalizeTag('#2024')).toBeNull()
  })

  it('caps the length', () => {
    expect(normalizeTag('a'.repeat(60))).toHaveLength(40)
  })
})

describe('extractHashtags', () => {
  it('finds inline tags, deduplicated, in order', () => {
    expect(extractHashtags('#Pricing idea for the #drop — see #pricing again')).toEqual(['pricing', 'drop'])
  })

  it('ignores URL fragments and mid-word hashes', () => {
    expect(extractHashtags('see https://example.com/page#section and c#sharp')).toEqual([])
  })

  it('ignores numbering', () => {
    expect(extractHashtags('point #1 about #logo')).toEqual(['logo'])
  })

  it('handles tags at line starts', () => {
    expect(extractHashtags('first line\n#second')).toEqual(['second'])
  })
})

describe('mergeTags / tagSuggestions', () => {
  it('merges without duplicates', () => {
    expect(mergeTags(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('orders suggestions by use, then name', () => {
    const notes = [{ tags: ['logo', 'pricing'] }, { tags: ['pricing'] }, { tags: ['ads'] }]
    expect(tagSuggestions(notes)).toEqual(['pricing', 'ads', 'logo'])
  })
})
