'use client'

import { useEffect, useState } from 'react'
import { Link2Off, NotebookText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Integration } from '@/lib/types'
import WidgetCard from '../../WidgetCard'

const PROVIDER = 'microsoft_onenote'

/** Messages for the ?error= codes app/api/microsoft/callback redirects back with. */
const CALLBACK_ERRORS: Record<string, string> = {
  microsoft_not_configured: 'MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET are not set on the server.',
  microsoft_denied: 'Consent was declined.',
  microsoft_no_code: 'Microsoft did not return an authorisation code.',
  microsoft_bad_state: 'Security check failed — start the connection again.',
  microsoft_no_refresh_token: 'Microsoft did not return a refresh token. Try again from a fresh consent screen.',
  microsoft_store_failed: 'Connected, but the token could not be saved. Has the migration been run?',
  microsoft_exchange_failed: 'Could not exchange the code with Microsoft. Check the client secret and redirect URI.',
}

/** Connect/disconnect card for OneNote — read-only, on-demand only, no sync. */
export default function MicrosoftOneNoteCard() {
  const [integration, setIntegration] = useState<Integration | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = () => {
    supabase
      .from('integrations')
      .select('*')
      .eq('provider', PROVIDER)
      .maybeSingle()
      .then(({ data }) => {
        setIntegration(data ?? null)
        setLoading(false)
      })
  }

  useEffect(refresh, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error')
    const connected = params.get('connected')
    if (!error && !connected) return

    const text = error
      ? (CALLBACK_ERRORS[error] ?? 'Could not connect to Microsoft.')
      : 'OneNote connected — pick a section from any module to start browsing.'
    // eslint-disable-next-line react-hooks/set-state-in-effect -- genuinely reading from an external system (the URL / history API), which is what effects are for
    setMessage(text)
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  const disconnect = async () => {
    setBusy(true)
    try {
      await fetch('/api/microsoft/disconnect', { method: 'POST' })
      setMessage('Disconnected. Linked modules keep their section — reconnect to resume browsing.')
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const connected = Boolean(integration)

  return (
    <WidgetCard
      title="Microsoft OneNote"
      accent="orange"
      icon={<NotebookText className="h-4 w-4" />}
      action={
        connected ? (
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            aria-label="Disconnect Microsoft OneNote"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant disabled:opacity-40 hover:bg-surface-container-high hover:text-error"
          >
            <Link2Off className="h-4 w-4" />
          </button>
        ) : undefined
      }
    >
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="flex flex-col gap-2">
          {connected ? (
            <>
              {integration?.account_email && (
                <p className="truncate text-xs text-on-surface">{integration.account_email}</p>
              )}
              {integration?.last_error && (
                <p className="rounded-md border border-error/30 bg-error/10 px-2 py-1 text-xs text-error">
                  {integration.last_error}
                </p>
              )}
              <a
                href="/api/microsoft/connect"
                className="w-fit rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high"
              >
                Reconnect
              </a>
            </>
          ) : (
            <>
              <p className="text-xs text-on-surface-variant">
                Connect a personal Microsoft account to browse a module&apos;s linked OneNote
                section in-app — read-only, fetched only when you open it, never indexed.
              </p>
              <a
                href="/api/microsoft/connect"
                className="w-fit rounded-lg bg-academic-orange px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
              >
                Connect
              </a>
            </>
          )}

          {message && <p className="text-xs text-on-surface-variant">{message}</p>}
        </div>
      )}
    </WidgetCard>
  )
}
