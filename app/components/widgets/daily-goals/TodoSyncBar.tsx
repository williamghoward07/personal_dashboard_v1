'use client'

import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { TODO_CONNECT_HREF, type TodoSyncStatus } from '@/lib/todos/sync-client'

const linkClass = 'font-medium text-on-surface underline-offset-2 hover:underline'

function syncedAtLabel(iso: string | undefined): string {
  if (!iso) return ''
  return ` at ${new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

// One-line Microsoft To Do status for the Todos page: syncing / synced /
// connect / reconnect / error, plus the result of a consent round trip.
export default function TodoSyncBar({
  status,
  onSync,
  connectResult,
}: {
  status: TodoSyncStatus
  onSync: () => void
  connectResult: { ok: boolean; message: string | null } | null
}) {
  const syncing = status.state === 'syncing'

  let body: React.ReactNode = null
  if (syncing) {
    body = (
      <>
        <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span>Syncing with Microsoft To Do…</span>
      </>
    )
  } else if (status.state === 'ok') {
    body = (
      <>
        <Cloud className="h-3.5 w-3.5 shrink-0" />
        <span>Microsoft To Do synced{syncedAtLabel(status.syncedAt)}</span>
        <button type="button" onClick={onSync} className={linkClass}>
          Sync now
        </button>
      </>
    )
  } else if (status.state === 'not_connected') {
    body = (
      <>
        <CloudOff className="h-3.5 w-3.5 shrink-0" />
        <span>Microsoft To Do isn&apos;t connected, so tasks from your phone won&apos;t show here.</span>
        <a href={TODO_CONNECT_HREF} className={linkClass}>
          Connect
        </a>
      </>
    )
  } else if (status.state === 'needs_reconnect') {
    body = (
      <>
        <CloudOff className="h-3.5 w-3.5 shrink-0 text-academic-orange" />
        <span>{status.message ?? 'Reconnect Microsoft to keep To Do syncing.'}</span>
        <a href={TODO_CONNECT_HREF} className={linkClass}>
          Reconnect
        </a>
      </>
    )
  } else if (status.state === 'error') {
    body = (
      <>
        <CloudOff className="h-3.5 w-3.5 shrink-0 text-academic-orange" />
        <span>To Do sync failed{status.message ? `: ${status.message}` : '.'}</span>
        <button type="button" onClick={onSync} className={linkClass}>
          Retry
        </button>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-1 text-xs text-on-surface-variant">
      {connectResult && (
        <p className={connectResult.ok ? 'text-primary-container' : 'text-academic-orange'}>
          {connectResult.ok ? 'Microsoft To Do connected.' : connectResult.message}
        </p>
      )}
      {body && (
        <p role="status" className="flex flex-wrap items-center gap-1.5">
          {body}
        </p>
      )}
    </div>
  )
}
