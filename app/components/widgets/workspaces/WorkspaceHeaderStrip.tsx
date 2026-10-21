import { Fragment } from 'react'
import Link from 'next/link'

export interface Crumb {
  label: string
  href: string
}

const crumbClass = 'font-display text-[11px] font-semibold uppercase tracking-[0.16em]'

// Page-local recreation of the mockup's breadcrumb strip. The app's real
// TopAppBar sits above this and is deliberately left untouched — restyling
// it would change all 16 routes and collide with the pending redesign pass.
// `crumbs` is the folder path (root first) between "Workspaces" and the
// current context label. `root` replaces "Workspaces" (module workspaces
// belong to Lectures).
export default function WorkspaceHeaderStrip({
  context,
  crumbs = [],
  root = { label: 'Workspaces', href: '/workspaces' },
}: {
  context: string
  crumbs?: Crumb[]
  root?: Crumb
}) {
  const separator = <span className={`${crumbClass} text-on-surface-variant/50`}>{'//'}</span>

  return (
    <div className="flex items-center gap-3 border-b border-outline-variant/60 pb-3">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={root.href} className={`${crumbClass} font-bold text-ws-accent transition-colors hover:brightness-110`}>
          {root.label}
        </Link>
        {crumbs.map((crumb) => (
          <Fragment key={crumb.href}>
            {separator}
            <Link href={crumb.href} className={`${crumbClass} text-on-surface-variant transition-colors hover:text-on-surface`}>
              {crumb.label}
            </Link>
          </Fragment>
        ))}
        {separator}
        <span className={`${crumbClass} text-on-surface-variant`}>{context}</span>
      </nav>

      <span className="ml-auto flex shrink-0 items-center gap-2">
        <span
          className="led-dot"
          style={{ '--led-color': 'var(--color-ws-accent)' } as React.CSSProperties}
          aria-hidden
        />
        <span className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/70">
          System Nominal
        </span>
      </span>
    </div>
  )
}
