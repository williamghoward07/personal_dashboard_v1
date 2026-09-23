'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut, Maximize, Minimize2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { supabase } from '@/lib/supabase'
import { useScrollDirection } from '@/lib/use-scroll-direction'
import { useFullscreen } from '@/lib/use-fullscreen'
import { ACCENT_TEXT, MODULE_ACCENT, type UiAccent } from '@/lib/theme'
import { activeNavItem } from '@/lib/nav-items'
import { BREADCRUMB_PREFIX, useResolvedPageTitle } from '@/lib/page-title'
import { StatusBadge } from '@/components/ui/status-badge'
import SettingsMenu from './settings/SettingsMenu'

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

type PillState = { label: string; accent: UiAccent; dot: 'pulse' | 'static'; title: string }

function pillState(label: string, rows: IntegrationRow[]): PillState {
  if (rows.length === 0) {
    return { label, accent: 'neutral', dot: 'static', title: `${label} is not connected` }
  }
  const failing = rows.find((row) => row.last_error)
  if (failing) {
    return { label, accent: 'amber', dot: 'static', title: `${label}: ${failing.last_error}` }
  }
  const syncedAt = rows
    .map((row) => row.last_synced_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  return {
    label,
    accent: 'mint',
    dot: 'pulse',
    title: syncedAt ? `${label} connected — last synced ${new Date(syncedAt).toLocaleString()}` : `${label} connected`,
  }
}

function IntegrationPills() {
  const [rows, setRows] = useState<IntegrationRow[] | null>(null)

  useEffect(() => {
    // RLS scopes `integrations` to the signed-in user, so no filter is
    // needed here beyond the columns.
    supabase
      .from('integrations')
      .select('provider, last_error, last_synced_at')
      .then(({ data, error }) => setRows(error ? [] : ((data as IntegrationRow[] | null) ?? [])))
  }, [])

  const pills = useMemo(() => {
    if (!rows) return null
    return PILLS.map(({ label, providers }) =>
      pillState(
        label,
        rows.filter((row) => providers.includes(row.provider))
      )
    )
  }, [rows])

  // Nothing until the read lands, so a connected service never flashes as
  // "off" on every page load.
  if (!pills) return null

  return (
    <div className="hidden shrink-0 items-center gap-2 xl:flex">
      {pills.map((pill) => (
        <StatusBadge key={pill.label} accent={pill.accent} dot={pill.dot} size="sm" title={pill.title}>
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

export default function TopAppBar() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const scrollDirection = useScrollDirection()
  const { isFullscreen, isSupported: fullscreenSupported, toggle: toggleFullscreen } = useFullscreen()

  useEffect(() => {
    const client = createClient()
    client.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user
      setEmail(sessionUser?.email ?? null)

      const fullName = sessionUser?.user_metadata?.full_name ?? sessionUser?.user_metadata?.name
      setUsername(fullName?.split(' ')[0] ?? sessionUser?.email?.split('@')[0] ?? null)
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
        <IntegrationPills />
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-4">
        <span className="hidden label-caps text-on-surface-variant lg:inline">
          {username ? `${username}'s Dashboard` : 'Personal Dashboard'}
        </span>
        {error && <span className="text-xs text-error">{error}</span>}
        {email && <span className="hidden text-xs text-on-surface-variant xl:inline">{email}</span>}
        {fullscreenSupported && (
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            className={ICON_BUTTON_CLASS}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <Maximize className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
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
          <span className="hidden md:inline">{signingOut ? 'Signing out…' : 'Sign out'}</span>
        </button>
      </div>
    </header>
  )
}
