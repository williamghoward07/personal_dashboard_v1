'use client'

import { usePathname } from 'next/navigation'
import { PageTitleDocumentSync, PageTitleProvider } from '@/lib/page-title'
import Sidebar from './Sidebar'
import TopAppBar from './TopAppBar'
import MobileBottomNav from './MobileBottomNav'
import SettingsProvider from './settings/SettingsProvider'

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Login renders bare: no rail, no bar, and no page-title sync, so the tab
  // keeps the static `metadata.title` from app/layout.tsx.
  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    <PageTitleProvider>
      <SettingsProvider>
        <PageTitleDocumentSync />
        <Sidebar />
        <div className="flex min-h-full flex-1 flex-col pt-16 pb-16 md:pl-20 md:pt-0 md:pb-0">
          <TopAppBar />
          {children}
        </div>
        <MobileBottomNav />
      </SettingsProvider>
    </PageTitleProvider>
  )
}
