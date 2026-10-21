import { describe, expect, it } from 'vitest'
import { bearerToken, tokensMatch } from './token'

describe('bearerToken', () => {
  it('reads the token from a Bearer header', () => {
    expect(bearerToken('Bearer abc123')).toBe('abc123')
    expect(bearerToken('bearer abc123')).toBe('abc123')
    expect(bearerToken('Bearer   abc123  ')).toBe('abc123')
  })

  it.each([
    ['missing header', null],
    ['empty', ''],
    ['no token', 'Bearer'],
    ['other scheme', 'Basic abc123'],
    ['two tokens', 'Bearer abc 123'],
  ])('returns null for %s', (_label, header) => {
    expect(bearerToken(header)).toBeNull()
  })
})

describe('tokensMatch', () => {
  it('matches only the exact token', () => {
    expect(tokensMatch('secret-token', 'secret-token')).toBe(true)
    expect(tokensMatch('secret-token', 'secret-tokeN')).toBe(false)
    expect(tokensMatch('secret', 'secret-token')).toBe(false)
  })

  it('never matches an empty token', () => {
    expect(tokensMatch('', '')).toBe(false)
    expect(tokensMatch('x', '')).toBe(false)
  })
})
