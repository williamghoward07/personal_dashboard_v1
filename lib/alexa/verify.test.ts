import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { isFreshTimestamp, isValidCertChainUrl, verifyAlexaSignature } from './verify'

describe('isValidCertChainUrl', () => {
  it('accepts Amazon\'s signing-certificate URLs', () => {
    expect(isValidCertChainUrl('https://s3.amazonaws.com/echo.api/echo-api-cert.pem')).toBe(true)
    expect(isValidCertChainUrl('https://s3.amazonaws.com:443/echo.api/../echo.api/cert.pem')).toBe(true)
    expect(isValidCertChainUrl('HTTPS://S3.AMAZONAWS.COM/echo.api/cert.pem')).toBe(true)
  })

  it.each([
    ['http scheme', 'http://s3.amazonaws.com/echo.api/cert.pem'],
    ['other host', 'https://s3.amazonaws.com.evil.com/echo.api/cert.pem'],
    ['userinfo trick', 'https://s3.amazonaws.com@evil.com/echo.api/cert.pem'],
    ['other path', 'https://s3.amazonaws.com/other/cert.pem'],
    ['path traversal out', 'https://s3.amazonaws.com/echo.api/../evil/cert.pem'],
    ['other port', 'https://s3.amazonaws.com:8443/echo.api/cert.pem'],
    ['not a URL', 'nonsense'],
    ['missing', null],
  ])('rejects %s', (_label, value) => {
    expect(isValidCertChainUrl(value)).toBe(false)
  })
})

describe('isFreshTimestamp', () => {
  const now = new Date('2026-09-21T12:00:00Z')

  it('accepts a timestamp within 150 seconds either side', () => {
    expect(isFreshTimestamp('2026-09-21T11:58:00Z', now)).toBe(true)
    expect(isFreshTimestamp('2026-09-21T12:01:00Z', now)).toBe(true)
  })

  it('rejects old, missing and malformed timestamps', () => {
    expect(isFreshTimestamp('2026-09-21T11:55:00Z', now)).toBe(false)
    expect(isFreshTimestamp(undefined, now)).toBe(false)
    expect(isFreshTimestamp('not a date', now)).toBe(false)
  })
})

describe('verifyAlexaSignature', () => {
  it('refuses a missing signature or bad cert URL without fetching anything', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await verifyAlexaSignature({ rawBody: '{}', certChainUrl: null, signature: 'abc' })).toBe(false)
    expect(
      await verifyAlexaSignature({ rawBody: '{}', certChainUrl: 'https://evil.com/echo.api/c.pem', signature: 'abc' }),
    ).toBe(false)
    expect(
      await verifyAlexaSignature({
        rawBody: '{}',
        certChainUrl: 'https://s3.amazonaws.com/echo.api/c.pem',
        signature: null,
      }),
    ).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
