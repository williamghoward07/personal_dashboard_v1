'use client'

import { useEffect, useState } from 'react'
import { Link2Off, RefreshCw, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Integration } from '@/lib/types'
import WidgetCard from '../../WidgetCard'
import { formatDate } from './shared'

const PROVIDER = 'google_contacts'

/** Messages for the ?error= codes the OAuth routes redirect back with. */
const CALLBACK_ERRORS: Record<string, string> = {
  google_not_configured: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set on the server.',
  google_denied: 'Consent was declined.',
  google_no_code: 'Google did not return an authorisation code.',
  google_bad_state: 'Security check failed — start the connection again.',
  google_no_refresh_token: 'Google did not return a refresh token. Try again from a fresh consent screen.',
  google_store_failed: 'Connected, but the token could not be saved. Has the migration been run?',
  google_exchange_failed: 'Could not exchange the code with Google. Check the client secret and redirect URI.',
}

export default function GoogleContactsCard({ onChange }: { onChange: () => void }) {
  const [integration, setIntegration] = useState<Integration | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
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

  // Read the OAuth round-trip result from the URL, then clear it so a refresh
  // doesn't replay the message. Done here rather than with useSearchParams to
  // avoid needing a Suspense boundary, and in an effect rather than at render
  // because window.location isn't available during SSR.
  //
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error')
    const connected = params.get('connected')
    if (!error && !connected) return

    const text = error
      ? (CALLBACK_ERRORS[error] ?? 'Could not connect to Google.')
      : 'Google Contacts connected — run a sync.'
    // eslint-disable-next-line react-hooks/set-state-in-effect -- genuinely reading from an external system (the URL / history API), which is what effects are for
    setMessage(text)
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  const sync = async () => {
    setSyncing(true)
    setMessage(null)
    try {
      const res = await fetch('/api/google/contacts/sync', { method: 'POST' })
      const body = await res.json()
      setMessage(
        res.ok
          ? body.imported === 0
            ? 'Already up to date.'
            : `Synced ${body.imported} contact${body.imported === 1 ? '' : 's'}.`
          : (body.error ?? 'Sync failed.'),
      )
      if (res.ok) onChange()
    } catch {
      setMessage('Sync failed — could not reach the server.')
    } finally {
      setSyncing(false)
      refresh()
    }
  }

  const disconnect = async () => {
    setSyncing(true)
    try {
      await fetch('/api/google/disconnect', { method: 'POST' })
      setMessage('Disconnected. Your people, notes and history are untouched.')
    } finally {
      setSyncing(false)
      refresh()
    }
  }

  const connected = Boolean(integration)

  return (
    <WidgetCard
      title="Google Contacts"
      accent="amber"
      icon={<Users className="h-4 w-4" />}
      className="sm:col-span-2 xl:col-span-1"
      action={
        connected ? (
          <button
            type="button"
            onClick={disconnect}
            disabled={syncing}
            aria-label="Disconnect Google Contacts"
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
              <p className="text-xs text-on-surface-variant">
                {integration?.last_synced_at
                  ? `Last synced ${formatDate(integration.last_synced_at)}`
                  : 'Never synced'}
              </p>
              {integration?.last_error && (
                <p className="rounded-md border border-error/30 bg-error/10 px-2 py-1 text-xs text-error">
                  {integration.last_error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={sync}
                  disabled={syncing}
                  className="flex items-center gap-1.5 rounded-lg bg-people-amber px-3 py-1.5 text-sm font-medium text-surface-container-lowest disabled:opacity-40 hover:brightness-110"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing' : 'Sync now'}
                </button>
                <a
                  href="/api/google/connect"
                  className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high"
                >
                  Reconnect
                </a>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-on-surface-variant">
                Import your contacts read-only. Google fills in names, emails, phones, company
                and LinkedIn; your notes, tags and history stay yours.
              </p>
              <a
                href="/api/google/connect"
                className="w-fit rounded-lg bg-people-amber px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110"
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
