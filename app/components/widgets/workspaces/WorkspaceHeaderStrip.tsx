import Link from 'next/link'

// Page-local recreation of the mockup's breadcrumb strip. The app's real
// TopAppBar sits above this and is deliberately left untouched — restyling
// it would change all 16 routes and collide with the pending redesign pass.
export default function WorkspaceHeaderStrip({ context }: { context: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-outline-variant/60 pb-3">
      <Link
        href="/workspaces"
        className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-workspace-teal transition-colors hover:brightness-110"
      >
        Workspaces
      </Link>
      <span className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/50">
        {'//'}
      </span>
      <span className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
        {context}
      </span>

      <span className="ml-auto flex items-center gap-2">
        <span
          className="led-dot"
          style={{ '--led-color': 'var(--color-workspace-teal)' } as React.CSSProperties}
          aria-hidden
        />
        <span className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/70">
          System Nominal
        </span>
      </span>
    </div>
  )
}
