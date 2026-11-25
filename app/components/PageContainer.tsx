import type { ReactNode } from 'react'
import type { Accent } from '@/lib/theme'

export default function PageContainer({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  accent?: Accent
  children: ReactNode
}) {
  return (
    <main className="workspace-page">
      <div>
        <h1 className="workspace-page-title">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
        )}
      </div>
      <div className="grid min-w-0 content-start grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {children}
      </div>
    </main>
  )
}
