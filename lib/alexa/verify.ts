import 'server-only'
import { X509Certificate, createVerify } from 'node:crypto'
import { rootCertificates } from 'node:tls'

// Request verification for the private Alexa skill, following Amazon's
// "Manually verify a skill request" steps. /api/alexa is public (no
// Supabase session), so this is what stops anyone else from writing to
// the owner's To Do and calendar. Every check must pass.

const MAX_AGE_SECONDS = 150
const CERT_HOST = 's3.amazonaws.com'
const CERT_PATH_PREFIX = '/echo.api/'
const CERT_SAN = 'echo-api.amazon.com'

/** Amazon only serves its signing certificates from one S3 path. */
export function isValidCertChainUrl(value: string | null): value is string {
  if (!value) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return (
    url.protocol === 'https:' &&
    url.hostname.toLowerCase() === CERT_HOST &&
    (url.port === '' || url.port === '443') &&
    url.username === '' &&
    url.password === '' &&
    url.pathname.startsWith(CERT_PATH_PREFIX)
  )
}

/** The request's own timestamp must be recent (replay protection). */
export function isFreshTimestamp(timestamp: string | undefined, now: Date): boolean {
  if (!timestamp) return false
  const sent = new Date(timestamp).getTime()
  return Number.isFinite(sent) && Math.abs(now.getTime() - sent) <= MAX_AGE_SECONDS * 1000
}

function parseChain(pem: string): X509Certificate[] {
  const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? []
  return blocks.map((block) => new X509Certificate(block))
}

const trustedRoots = rootCertificates.map((pem) => new X509Certificate(pem))

function isTrustedRoot(cert: X509Certificate): boolean {
  return trustedRoots.some((root) => cert.raw.equals(root.raw) || (cert.checkIssued(root) && cert.verify(root.publicKey)))
}

/**
 * Walk up from the leaf until a certificate is (or is signed by) a root in
 * Node's trust store. Stopping there, rather than demanding the whole
 * supplied chain be trusted, matters: Amazon's chain ends with a
 * cross-signed root whose own issuer isn't in the store.
 */
export function isChainValid(chain: X509Certificate[], now: Date): boolean {
  for (let i = 0; i < chain.length; i++) {
    const cert = chain[i]
    if (now < new Date(cert.validFrom) || now > new Date(cert.validTo)) return false
    if (isTrustedRoot(cert)) return true
    const next = chain[i + 1]
    if (!next || !cert.checkIssued(next) || !cert.verify(next.publicKey)) return false
  }
  return false
}

const chainCache = new Map<string, { chain: X509Certificate[]; fetchedAt: number }>()
const CHAIN_CACHE_MS = 60 * 60 * 1000

async function loadChain(url: string, now: Date): Promise<X509Certificate[] | null> {
  const cached = chainCache.get(url)
  if (cached && now.getTime() - cached.fetchedAt < CHAIN_CACHE_MS) return cached.chain

  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) return null
  const chain = parseChain(await res.text())
  if (chain.length === 0) return null
  chainCache.set(url, { chain, fetchedAt: now.getTime() })
  return chain
}

/**
 * Verify that `rawBody` was signed by Amazon. Needs the exact bytes as
 * received (read the body as text before parsing it).
 */
export async function verifyAlexaSignature({
  rawBody,
  certChainUrl,
  signature,
  now = new Date(),
}: {
  rawBody: string
  certChainUrl: string | null
  signature: string | null
  now?: Date
}): Promise<boolean> {
  if (!signature || !isValidCertChainUrl(certChainUrl)) return false
  try {
    const chain = await loadChain(certChainUrl, now)
    if (!chain || !isChainValid(chain, now)) return false
    const leaf = chain[0]
    if (!(leaf.subjectAltName ?? '').split(',').some((san) => san.trim() === `DNS:${CERT_SAN}`)) return false
    return createVerify('RSA-SHA256').update(rawBody).verify(leaf.publicKey, signature, 'base64')
  } catch (error) {
    console.error('Alexa signature verification failed:', error)
    return false
  }
}
