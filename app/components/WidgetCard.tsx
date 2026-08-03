import type { ReactNode } from 'react'

export default function WidgetCard({
  title,
  action,
  className = '',
  children,
}: {
  title: string
  action?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-xl border border-black/10 bg-white/60 p-4 shadow-sm dark:border-white/10 dark:bg-white/5 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-black/60 dark:text-white/60">
          {title}
        </h2>
        {action}
      </div>
      <div className="flex-1 text-sm text-black/40 dark:text-white/40">
        {children ?? 'Coming soon'}
      </div>
    </section>
  )
}
