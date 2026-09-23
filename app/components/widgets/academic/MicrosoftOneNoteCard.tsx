'use client'

import { useEffect, useState } from 'react'
import { Link2Off, NotebookText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Integration } from '@/lib/types'
import { takeMicrosoftConnectResult } from '@/lib/microsoft/connect-errors'
import WidgetCard from '../../WidgetCard'

const PROVIDER = 'microsoft_onenote'

/**
 * Connect/disconnect card for the Microsoft account. OneNote is read-only
 * and on-demand; the same connection also powers the To Do sync on /todos.
 */
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
    const result = takeMicrosoftConnectResult()
    if (!result) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- genuinely reading from an external system (the URL / history API), which is what effects are for
    setMessage(
      result.message ?? 'Connected — pick a section from any module to start browsing. To Do now syncs on the Todos page.'
    )
  }, [])

  const disconnect = async () => {
    setBusy(true)
    try {
      await fetch('/api/microsoft/disconnect', { method: 'POST' })
      setMessage(
        'Disconnected. Linked modules keep their section, and To Do tasks already pulled stay as todos — reconnect to resume.'
      )
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
                Connect a personal Microsoft account to see a module&apos;s linked OneNote
                pages and open them straight in OneNote — read-only, fetched only when you
                open it, never indexed. The same connection syncs Microsoft To Do with the
                Todos page.
              </p>
              <a
                href="/api/microsoft/connect"
                className="w-fit rounded-lg bg-academic-orange px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110"
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
