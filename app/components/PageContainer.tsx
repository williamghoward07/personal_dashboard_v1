import type { ReactNode } from 'react'
import type { Accent } from '@/lib/theme'
import { ACCENT_TEXT } from '@/lib/theme'

export default function PageContainer({
  title,
  subtitle,
  accent = 'neutral',
  children,
}: {
  title: string
  subtitle?: string
  accent?: Accent
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      <div>
        <h1 className={`font-display text-headline-lg font-bold ${ACCENT_TEXT[accent]}`}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
        )}
      </div>
      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {children}
      </div>
    </main>
  )
}
