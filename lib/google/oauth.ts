// Minimal Google OAuth 2.0 helpers — four fetch calls, no `googleapis` package.
// Server-only: GOOGLE_CLIENT_SECRET must never reach the browser.

export const GOOGLE_CONTACTS_PROVIDER = 'google_contacts'
// Full write scope — needed so contact-card edits made in the app (name,
// email, phone, company, LinkedIn) can be pushed back to Google, not just
// pulled from it. Anyone connected under the old .readonly scope needs to
// hit Reconnect once to re-consent; prompt=consent below makes sure that
// consent screen actually shows the new permission.
export const GOOGLE_CONTACTS_SCOPES = [
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/userinfo.email',
]

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'

function clientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set')
  }
  return { clientId, clientSecret }
}

/**
 * The redirect URI is derived from the request origin rather than an env var,
 * so the same build works on localhost, a Vercel preview and production. Every
 * origin you actually use must be registered in the Google Cloud console.
 */
export function redirectUriFor(origin: string) {
  return `${origin}/api/google/callback`
}

export function consentUrl({ origin, state }: { origin: string; state: string }) {
  const { clientId } = clientCredentials()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUriFor(origin),
    response_type: 'code',
    scope: GOOGLE_CONTACTS_SCOPES.join(' '),
    // offline + consent are what actually produce a refresh token; without
    // prompt=consent Google omits it on every grant after the first.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope?: string
  token_type: string
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Google token request failed (${res.status}): ${detail}`)
  }
  return res.json()
}

export async function exchangeCode({ code, origin }: { code: string; origin: string }) {
  const { clientId, clientSecret } = clientCredentials()
  return postToken(
    new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUriFor(origin),
      grant_type: 'authorization_code',
    }),
  )
}

export async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = clientCredentials()
  return postToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  )
}

export async function revokeToken(token: string) {
  // Best-effort: a token Google has already expired returns 400, which is fine.
  await fetch(REVOKE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined)
}

export async function fetchAccountEmail(accessToken: string) {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { email?: string }
  return data.email ?? null
}
