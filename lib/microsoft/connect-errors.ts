// Messages for the ?error= codes app/api/microsoft/{connect,callback}
// redirect back with. Browser-safe (no secrets), unlike ./oauth.

const CONNECT_ERRORS: Record<string, string> = {
  microsoft_not_configured: 'MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET are not set on the server.',
  microsoft_denied: 'Consent was declined.',
  microsoft_no_code: 'Microsoft did not return an authorisation code.',
  microsoft_bad_state: 'Security check failed — start the connection again.',
  microsoft_no_refresh_token: 'Microsoft did not return a refresh token. Try again from a fresh consent screen.',
  microsoft_store_failed: 'Connected, but the token could not be saved. Has the migration been run?',
  microsoft_exchange_failed: 'Could not exchange the code with Microsoft. Check the client secret and redirect URI.',
}

export function microsoftConnectError(code: string): string {
  return CONNECT_ERRORS[code] ?? 'Could not connect to Microsoft.'
}

/**
 * Reads (and strips) a ?connected / ?error= result from the current URL.
 * Returns null when the page wasn't reached from the consent flow.
 */
export function takeMicrosoftConnectResult(): { ok: boolean; message: string | null } | null {
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')
  const connected = params.get('connected')
  if (!error && !connected) return null
  window.history.replaceState({}, '', window.location.pathname)
  return error ? { ok: false, message: microsoftConnectError(error) } : { ok: true, message: null }
}
