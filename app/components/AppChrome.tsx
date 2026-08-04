'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import TopAppBar from './TopAppBar'

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    <>
      <Sidebar />
      <div className="flex min-h-full flex-1 flex-col pl-20">
        <TopAppBar />
        {children}
      </div>
    </>
  )
}
