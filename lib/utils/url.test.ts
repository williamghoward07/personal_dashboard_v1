import { describe, expect, it } from 'vitest'
import { findDuplicateUrl, looksLikeUrl, normalizeUrl, urlKey } from './url'

describe('normalizeUrl', () => {
  it('adds https when missing', () => {
    expect(normalizeUrl('example.com/a')).toBe('https://example.com/a')
  })
  it('rejects blanks and junk', () => {
    expect(normalizeUrl('  ')).toBeNull()
    expect(normalizeUrl('not a url')).toBeNull()
  })
})

describe('urlKey', () => {
  it('ignores scheme, www, case, trailing slash and fragment', () => {
    expect(urlKey('https://www.Example.com/docs/')).toBe(urlKey('http://example.com/docs#intro'))
  })
  it('keeps query strings distinct', () => {
    expect(urlKey('https://a.com/p?id=1')).not.toBe(urlKey('https://a.com/p?id=2'))
  })
})

describe('findDuplicateUrl', () => {
  const items = [{ id: '1', url: 'https://canvas.ac.uk/' }]
  it('finds a match', () => {
    expect(findDuplicateUrl(items, 'canvas.ac.uk')?.id).toBe('1')
  })
  it('returns null without one', () => {
    expect(findDuplicateUrl(items, 'moodle.ac.uk')).toBeNull()
  })
})

describe('looksLikeUrl', () => {
  it('accepts links with or without a scheme', () => {
    expect(looksLikeUrl('https://durham.rl.talis.com/items/1')).toBe(true)
    expect(looksLikeUrl('durham.rl.talis.com/items/1')).toBe(true)
    expect(looksLikeUrl('www.bbc.co.uk')).toBe(true)
  })

  it('treats words as a task', () => {
    expect(looksLikeUrl('Read Harvey ch. 2')).toBe(false)
    expect(looksLikeUrl('ch.2')).toBe(false)
    expect(looksLikeUrl('Revise')).toBe(false)
    expect(looksLikeUrl('')).toBe(false)
  })
})
