'use client'

import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Hexagon, Plus } from 'lucide-react'
import { ACCENT_VAR, MODULE_ACCENT } from '@/lib/theme'
import { isNavItemActive } from '@/lib/nav-items'
import SettingsMenu from './settings/SettingsMenu'
import { useVisibleNavItems } from './settings/use-visible-nav-items'
import styles from './WorkspaceShell.module.css'

export default function Sidebar({ compact, accountMenu }: { compact: boolean; accountMenu?: ReactNode }) {
  const pathname = usePathname()
  const items = useVisibleNavItems()

  return (
    <nav
      aria-label={compact ? 'Workspace' : 'Main'}
      className={compact ? styles.rail : `${styles.rail} ${styles.legacyRail}`}
    >
      <Link
        href="/"
        aria-label="Study Copilot home"
        title={compact ? undefined : 'Study Copilot'}
        className={`${styles.railLink} ${styles.brand}`}
      >
        <Hexagon aria-hidden strokeWidth={1.75} />
        <span className={styles.railLabel}>Study Copilot</span>
      </Link>

      <ul className={styles.railList}>
        {items.map((item) => {
          const { href, label, icon: Icon, module } = item
          return (
            <li key={href}>
              <Link
                href={href}
                title={compact ? undefined : label}
                aria-current={isNavItemActive(item, pathname) ? 'page' : undefined}
                style={{ '--nav-accent': ACCENT_VAR[MODULE_ACCENT[module]] } as CSSProperties}
                className={styles.railLink}
              >
                <Icon aria-hidden strokeWidth={1.75} />
                <span className={styles.railLabel}>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      <div className={styles.railFooter}>
        <Link
          href="/brain-dump"
          aria-label="Quick capture"
          title={compact ? undefined : 'Quick capture'}
          className={styles.railLink}
        >
          <Plus aria-hidden strokeWidth={1.75} />
          <span className={styles.railLabel}>Quick capture</span>
        </Link>
        {compact ? (
          <>
            <SettingsMenu
              triggerClassName={styles.railLink}
              labelClassName={styles.railLabel}
              panelClassName={styles.workspacePanel}
              focusPanel
            />
            {accountMenu}
          </>
        ) : (
          <>
            <span aria-hidden className="h-px w-8 bg-outline-variant" />
            <span className="flex h-4 w-4 items-center justify-center" title="System live">
              <span className="led-dot" aria-hidden />
              <span className="sr-only">System live</span>
            </span>
          </>
        )}
      </div>
    </nav>
  )
}
