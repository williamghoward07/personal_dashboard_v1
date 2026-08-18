'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import TopAppBar from './TopAppBar'
import MobileBottomNav from './MobileBottomNav'

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    <>
      <Sidebar />
      <div className="flex min-h-full flex-1 flex-col pt-16 pb-16 md:pl-20 md:pt-0 md:pb-0">
        <TopAppBar />
        {children}
      </div>
      <MobileBottomNav />
    </>
  )
}
