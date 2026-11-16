'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut, Maximize, Minimize2, Plus, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { supabase } from '@/lib/supabase'
import { useScrollDirection } from '@/lib/use-scroll-direction'
import { useFullscreen } from '@/lib/use-fullscreen'
import { ACCENT_TEXT, MODULE_ACCENT, type UiAccent } from '@/lib/theme'
import { activeNavItem } from '@/lib/nav-items'
import { BREADCRUMB_PREFIX, useResolvedPageTitle } from '@/lib/page-title'
import { StatusBadge } from '@/components/ui/status-badge'
import Popover from './Popover'
import SettingsMenu from './settings/SettingsMenu'
import styles from './WorkspaceShell.module.css'

// The chrome icon button — shared verbatim by full screen, settings and
// sign out so the three read as one control group.
const ICON_BUTTON_CLASS =
  'flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-high px-2 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors duration-200 hover:bg-surface-bright hover:text-on-surface disabled:opacity-60 md:px-3'

// ---------------------------------------------------------------------------
// Live integration status pills (DESIGN.md §5.1)
// ---------------------------------------------------------------------------

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

type PillState = {
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

function IntegrationPills({ pills }: { pills: PillState[] | null | undefined }) {
  // Nothing until the read lands, so a connected service never flashes as
  // "off" on every page load.
  if (!pills) return null

  return (
    <div className="hidden shrink-0 items-center gap-2 xl:flex">
      {pills.map((pill) => (
        <StatusBadge
          key={pill.label}
          accent={pill.accent}
          dot={pill.accent === 'mint' ? 'pulse' : 'static'}
          size="sm"
          title={[pill.label, pill.status, pill.detail].filter(Boolean).join(' · ')}
        >
          {pill.label}
        </StatusBadge>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------

function Breadcrumb() {
  const pathname = usePathname()
  const { module: moduleName, context, breadcrumb } = useResolvedPageTitle()

  const navItem = activeNavItem(pathname)
  const accent = navItem ? MODULE_ACCENT[navItem.module] : 'neutral'
  // A neutral module has no signal colour, so the segment takes `primary`
  // (DESIGN.md §2.2 — the brightest thing that isn't an accent) rather than
  // sinking to the same dim sage as the prefix.
  const moduleClass = accent === 'neutral' ? 'text-primary' : ACCENT_TEXT[accent]

  return (
    <nav aria-label="Breadcrumb" title={breadcrumb} className="flex min-w-0 items-center gap-1.5 label-caps">
      <span className="hidden shrink-0 text-outline lg:inline">{BREADCRUMB_PREFIX}</span>
      <span aria-hidden className="hidden shrink-0 text-outline lg:inline">
        /
      </span>
      <span className={`shrink-0 ${moduleClass}`}>{moduleName}</span>
      {context && (
        <>
          <span aria-hidden className="shrink-0 text-outline">
            {'//'}
          </span>
          <span className="min-w-0 truncate text-on-surface">{context}</span>
        </>
      )}
    </nav>
  )
}

// ---------------------------------------------------------------------------

export default function TopAppBar({ compact }: { compact: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const scrollDirection = useScrollDirection()
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
  const FullscreenIcon = isFullscreen ? Minimize2 : Maximize
  const signOutLabel = signingOut ? 'Signing out…' : 'Sign out'

  if (compact) {
    return (
      <header className={styles.compactBar}>
        <Link
          href="/brain-dump"
          className={`${styles.utilityButton} ${styles.mobileCapture}`}
          aria-label="Quick capture"
          title="Quick capture"
        >
          <Plus aria-hidden size={17} strokeWidth={1.75} />
        </Link>
        <SettingsMenu triggerClassName={styles.utilityButton} />
        <Popover
          label="Account"
          align="end"
          panelClassName={styles.accountPanel}
          trigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label="Account"
              title="Account"
              className={`${styles.utilityButton} ${styles.accountButton}`}
            >
              {username ? username[0].toUpperCase() : <UserRound aria-hidden size={16} strokeWidth={1.75} />}
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
      </header>
    )
  }

  // The bar collapses on scroll-down (mobile only — it is sticky from `md`
  // up), but never while the settings panel is open, or the panel would
  // slide off screen with it.
  const collapsed = scrollDirection === 'down' && !settingsOpen

  return (
    <header
      className={`fixed top-0 z-30 flex h-16 w-full items-center justify-between gap-3 border-b border-outline-variant bg-surface-container-lowest/90 px-4 backdrop-blur-xl transition-transform duration-200 md:sticky md:translate-y-0 md:gap-4 md:px-8 ${
        collapsed ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
        <Breadcrumb />
        <IntegrationPills pills={pills} />
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-4">
        <span className="hidden label-caps text-on-surface-variant lg:inline">
          {username ? `${username}'s Dashboard` : 'Personal Dashboard'}
        </span>
        {error && <span className="text-xs text-error" role="alert">{error}</span>}
        {email && <span className="hidden text-xs text-on-surface-variant xl:inline">{email}</span>}
        {fullscreenSupported && (
          <button
            type="button"
            onClick={toggleFullscreen}
            title={fullscreenLabel}
            aria-label={fullscreenLabel}
            className={ICON_BUTTON_CLASS}
          >
            <FullscreenIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="hidden md:inline">{isFullscreen ? 'Exit full screen' : 'Full screen'}</span>
          </button>
        )}
        <SettingsMenu triggerClassName={ICON_BUTTON_CLASS} onOpenChange={setSettingsOpen} />
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          title="Sign out"
          aria-label="Sign out"
          className={ICON_BUTTON_CLASS}
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="hidden md:inline">{signOutLabel}</span>
        </button>
      </div>
    </header>
  )
}
