'use client'

import { usePathname } from 'next/navigation'
import { PageTitleDocumentSync, PageTitleProvider } from '@/lib/page-title'
import AccountMenu, { useChromeAccount } from './AccountMenu'
import Sidebar from './Sidebar'
import TopAppBar from './TopAppBar'
import MobileBottomNav from './MobileBottomNav'
import SettingsProvider from './settings/SettingsProvider'
import styles from './WorkspaceShell.module.css'

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Login renders bare: no rail, no bar, and no page-title sync, so the tab
  // keeps the static `metadata.title` from app/layout.tsx.
  if (pathname === '/login') {
    return <>{children}</>
  }

  return <AuthenticatedChrome pathname={pathname}>{children}</AuthenticatedChrome>
}

function AuthenticatedChrome({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const account = useChromeAccount()
  const isWorkspace = pathname === '/' ||
    pathname === '/lectures' ||
    pathname.startsWith('/lectures/') ||
    pathname === '/calendar'

  return (
    <PageTitleProvider>
      <SettingsProvider>
        <PageTitleDocumentSync />
        <div className={isWorkspace ? `workspace-ui ${styles.shell}` : styles.shell}>
          <Sidebar
            compact={isWorkspace}
            accountMenu={isWorkspace ? <AccountMenu account={account} /> : undefined}
          />
          <div className={`${styles.content}${isWorkspace ? '' : ` ${styles.legacyContent}`}`}>
            {!isWorkspace && <TopAppBar account={account} />}
            {children}
          </div>
          <MobileBottomNav />
        </div>
      </SettingsProvider>
    </PageTitleProvider>
  )
}
