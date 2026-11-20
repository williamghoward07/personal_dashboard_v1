'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Maximize, Minimize2, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { supabase } from '@/lib/supabase'
import { useFullscreen } from '@/lib/use-fullscreen'
import type { UiAccent } from '@/lib/theme'
import Popover from './Popover'
import styles from './WorkspaceShell.module.css'

type IntegrationRow = { provider: string; last_error: string | null; last_synced_at: string | null }

// One pill per *service*, not per OAuth grant: Google Calendar and Google
// Contacts are two rows in `integrations` but one connection as far as the
// user is concerned. Provider strings come from lib/google/oauth.ts,
// lib/microsoft/oauth.ts and app/api/starling/sync/route.ts.
const PILLS: { label: string; providers: string[] }[] = [
  { label: 'Starling', providers: ['starling'] },
  { label: 'Google', providers: ['google', 'google_contacts'] },
  { label: 'Microsoft', providers: ['microsoft_onenote'] },
]

export type PillState = {
  label: string
  accent: UiAccent
  status: string
  detail?: string
}

function pillState(label: string, rows: IntegrationRow[]): PillState {
  if (rows.length === 0) {
    return { label, accent: 'neutral', status: 'Not connected' }
  }
  const failing = rows.find((row) => row.last_error)
  if (failing) {
    return { label, accent: 'amber', status: 'Sync error', detail: failing.last_error ?? undefined }
  }
  const syncedAt = rows
    .map((row) => row.last_synced_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  return {
    label,
    accent: 'mint',
    status: 'Connected',
    detail: syncedAt ? `Last synced ${new Date(syncedAt).toLocaleString()}` : undefined,
  }
}

function useIntegrationStatus() {
  const [rows, setRows] = useState<IntegrationRow[] | null | undefined>(undefined)

  useEffect(() => {
    // RLS scopes `integrations` to the signed-in user, so no filter is
    // needed here beyond the columns.
    supabase
      .from('integrations')
      .select('provider, last_error, last_synced_at')
      .then(({ data, error }) => setRows(error ? null : ((data as IntegrationRow[] | null) ?? [])))
  }, [])

  return useMemo(() => {
    if (!rows) return rows
    return PILLS.map(({ label, providers }) =>
      pillState(
        label,
        rows.filter((row) => providers.includes(row.provider))
      )
    )
  }, [rows])
}

export function useChromeAccount() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isFullscreen, isSupported: fullscreenSupported, toggle: toggleFullscreen } = useFullscreen()
  const pills = useIntegrationStatus()

  useEffect(() => {
    const client = createClient()
    client.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user
      setEmail(sessionUser?.email ?? null)

      const fullName = sessionUser?.user_metadata?.full_name ?? sessionUser?.user_metadata?.name
      setDisplayName(typeof fullName === 'string' && fullName.trim() ? fullName.trim() : null)
    })
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    setError(null)

    const client = createClient()
    const { error: signOutError } = await client.auth.signOut()

    if (signOutError) {
      setError(signOutError.message)
      setSigningOut(false)
      return
    }

    router.refresh()
    router.push('/login')
  }

  const username = displayName?.split(' ')[0] ?? email?.split('@')[0] ?? null
  const fullscreenLabel = isFullscreen ? 'Exit full screen' : 'Enter full screen'
  return {
    email,
    displayName,
    username,
    pills,
    isFullscreen,
    fullscreenSupported,
    fullscreenLabel,
    toggleFullscreen,
    handleSignOut,
    signingOut,
    signOutLabel: signingOut ? 'Signing out…' : 'Sign out',
    error,
  }
}

export type ChromeAccount = ReturnType<typeof useChromeAccount>

export default function AccountMenu({ account }: { account: ChromeAccount }) {
  const {
    displayName, username, email, pills, isFullscreen, fullscreenSupported,
    fullscreenLabel, toggleFullscreen, handleSignOut, signingOut, signOutLabel, error,
  } = account
  const FullscreenIcon = isFullscreen ? Minimize2 : Maximize

  return (
    <Popover
      label="Account"
      align="end"
      focusPanel
      panelClassName={`${styles.workspacePanel} ${styles.accountPanel}`}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label="Account"
          className={styles.railLink}
        >
          <span className={styles.accountAvatar} aria-hidden>
            {username ? username[0].toUpperCase() : <UserRound size={15} strokeWidth={1.75} />}
          </span>
          <span className={styles.railLabel}>Account</span>
        </button>
      )}
    >
      <div className={styles.accountIdentity}>
        <div className={styles.accountName}>{displayName ?? username ?? 'Account'}</div>
        {email && <div>{email}</div>}
      </div>
      <div className={styles.accountSection}>
        <h2 className={styles.accountHeading}>Integrations</h2>
        {pills ? (
          <ul className={styles.connections}>
            {pills.map(({ label, status, detail }) => (
              <li key={label}>
                <div className={styles.connection}>
                  <span>{label}</span>
                  <span>{status}</span>
                </div>
                {detail && <div className={styles.connectionDetail}>{detail}</div>}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.connectionDetail}>
            {pills === undefined ? 'Checking connections…' : 'Connection status unavailable'}
          </p>
        )}
      </div>
      <div className={styles.accountActions}>
        {fullscreenSupported && (
          <button type="button" onClick={toggleFullscreen} className={styles.accountAction}>
            <FullscreenIcon aria-hidden size={16} strokeWidth={1.75} />
            {fullscreenLabel}
          </button>
        )}
        <button type="button" onClick={handleSignOut} disabled={signingOut} className={styles.accountAction}>
          <LogOut aria-hidden size={16} strokeWidth={1.75} />
          {signOutLabel}
        </button>
        {error && <p className={styles.accountError} role="alert">{error}</p>}
      </div>
    </Popover>
  )
}
