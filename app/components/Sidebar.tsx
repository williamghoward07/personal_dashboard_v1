'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Hexagon, Plus } from 'lucide-react'
import { ACCENT_VAR, MODULE_ACCENT } from '@/lib/theme'
import { isNavItemActive } from '@/lib/nav-items'
import { useVisibleNavItems } from './settings/use-visible-nav-items'

/**
 * The §5.1 icon rail: 80px wide on `surface-container-lowest`, a 40px logo
 * tile, 48px `rounded-xl` nav targets at `gap-3`, and a pinned footer group
 * (quick capture, a hairline divider, the "system live" LED).
 *
 * Targets are icon-only at 48px, so each one's name lives in `title` +
 * `aria-label`; the top bar's breadcrumb is what actually tells you where
 * you are. The active item inverts to mint per §5.1, and the module's own
 * accent shows on hover via `--nav-accent` (a variable rather than a
 * `hover:text-*` lookup table, which Tailwind's JIT can't assemble).
 */
export default function Sidebar() {
  const pathname = usePathname()
  const items = useVisibleNavItems()

  return (
    <nav
      aria-label="Main"
      className="fixed left-0 top-0 z-40 hidden h-full w-20 flex-col items-center gap-4 border-r border-outline-variant bg-surface-container-lowest py-5 md:flex"
    >
      <Link
        href="/"
        aria-label="Study Copilot home"
        title="Study Copilot"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-high text-primary-container transition-all duration-200 hover:border-primary-container/50 hover:shadow-[0_0_15px_rgba(0,255,157,0.2)]"
      >
        <Hexagon className="h-5 w-5" strokeWidth={1.75} />
      </Link>

      <ul className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {items.map((item) => {
          const { href, label, icon: Icon, module } = item
          const active = isNavItemActive(item, pathname)
          return (
            <li key={href}>
              <Link
                href={href}
                title={label}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                style={{ '--nav-accent': ACCENT_VAR[MODULE_ACCENT[module]] } as React.CSSProperties}
                className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200 ${
                  active
                    ? 'bg-primary-container text-on-primary-container'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-[var(--nav-accent)]'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="flex shrink-0 flex-col items-center gap-3">
        <Link
          href="/brain-dump"
          title="Quick capture"
          aria-label="Quick capture"
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant transition-all duration-200 hover:bg-surface-bright hover:text-on-surface active:scale-95"
        >
          <Plus className="h-5 w-5" strokeWidth={1.75} />
        </Link>
        <span aria-hidden className="h-px w-8 bg-outline-variant" />
        <span className="flex h-4 w-4 items-center justify-center" title="System live">
          <span className="led-dot" aria-hidden />
          <span className="sr-only">System live</span>
        </span>
      </div>
    </nav>
  )
}
