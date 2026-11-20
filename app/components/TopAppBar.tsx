'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { LogOut, Maximize, Minimize2 } from 'lucide-react'
import { useScrollDirection } from '@/lib/use-scroll-direction'
import { ACCENT_TEXT, MODULE_ACCENT } from '@/lib/theme'
import { activeNavItem } from '@/lib/nav-items'
import { BREADCRUMB_PREFIX, useResolvedPageTitle } from '@/lib/page-title'
import { StatusBadge } from '@/components/ui/status-badge'
import type { ChromeAccount, PillState } from './AccountMenu'
import SettingsMenu from './settings/SettingsMenu'

// The chrome icon button — shared verbatim by full screen, settings and
// sign out so the three read as one control group.
const ICON_BUTTON_CLASS =
  'flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-high px-2 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors duration-200 hover:bg-surface-bright hover:text-on-surface disabled:opacity-60 md:px-3'

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

export default function TopAppBar({ account }: { account: ChromeAccount }) {
  const {
    email, username, pills, isFullscreen, fullscreenSupported, fullscreenLabel,
    toggleFullscreen, handleSignOut, signingOut, signOutLabel, error,
  } = account
  const [settingsOpen, setSettingsOpen] = useState(false)
  const scrollDirection = useScrollDirection()
  const FullscreenIcon = isFullscreen ? Minimize2 : Maximize

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
