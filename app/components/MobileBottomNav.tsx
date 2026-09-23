'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ACCENT_TEXT, MODULE_ACCENT } from '@/lib/theme'
import { isNavItemActive } from '@/lib/nav-items'
import { useVisibleNavItems } from './settings/use-visible-nav-items'

export default function MobileBottomNav() {
  const pathname = usePathname()
  const items = useVisibleNavItems()
  const activeRef = useRef<HTMLAnchorElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [pathname])

  return (
    <nav
      aria-label="Main"
      className="edge-fade-x fixed inset-x-0 bottom-0 z-40 flex h-16 snap-x snap-mandatory items-center gap-1 overflow-x-auto border-t border-outline-variant bg-surface-container-lowest px-2 md:hidden"
    >
      {items.map((item) => {
        const { href, label, icon: Icon, module } = item
        const active = isNavItemActive(item, pathname)
        const accentText = ACCENT_TEXT[MODULE_ACCENT[module]]
        return (
          <Link
            key={href}
            href={href}
            ref={active ? activeRef : undefined}
            title={label}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 snap-center flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors duration-200 ${
              active ? `bg-surface-container-high ${accentText}` : 'text-on-surface-variant'
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
            <span className="font-display text-[9px] font-semibold tracking-wide">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
