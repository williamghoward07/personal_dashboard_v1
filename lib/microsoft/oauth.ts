// Minimal Microsoft identity platform OAuth 2.0 helpers — mirrors
// lib/google/oauth.ts's shape (four fetch calls, no SDK). Server-only:
// MICROSOFT_CLIENT_SECRET must never reach the browser.

export const MICROSOFT_ONENOTE_PROVIDER = 'microsoft_onenote'
// Read-only on personal Microsoft accounts only supports Notes.Read (no
// .All variant exists for personal accounts). offline_access is required
// to get a refresh token; openid/profile let us show the signed-in
// account's display name without an extra Graph call.
export const MICROSOFT_ONENOTE_SCOPES = [
  'https://graph.microsoft.com/Notes.Read',
  'offline_access',
  'openid',
  'profile',
]

// "consumers" (not "common") because the Azure app registration is
// "Personal Microsoft accounts only" — common is for apps that also
// accept work/school accounts.
const AUTH_ENDPOINT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize'
const TOKEN_ENDPOINT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
const ME_ENDPOINT = 'https://graph.microsoft.com/v1.0/me'

function clientCredentials() {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET are not set')
  }
  return { clientId, clientSecret }
}

/**
 * The redirect URI is derived from the request origin rather than an env var,
 * so the same build works on localhost, a Vercel preview and production. Every
 * origin you actually use must be registered in the Azure app registration.
 */
export function redirectUriFor(origin: string) {
  return `${origin}/api/microsoft/callback`
}

export function consentUrl({ origin, state }: { origin: string; state: string }) {
  const { clientId } = clientCredentials()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUriFor(origin),
    response_type: 'code',
    response_mode: 'query',
    scope: MICROSOFT_ONENOTE_SCOPES.join(' '),
    // Forces the consent screen every time, same reasoning as Google's
    // prompt=consent — makes sure a scope change is actually re-consented.
    prompt: 'consent',
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
    throw new Error(`Microsoft token request failed (${res.status}): ${detail}`)
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

// The Microsoft identity platform has no public token-revocation REST
// endpoint (unlike Google's /revoke) — disconnecting just forgets the
// local token; see app/api/microsoft/disconnect/route.ts.

export async function fetchAccountDisplay(accessToken: string) {
  const res = await fetch(ME_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { userPrincipalName?: string; displayName?: string }
  return data.userPrincipalName ?? data.displayName ?? null
}
