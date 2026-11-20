'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { ACCENT_TEXT, MODULE_ACCENT } from '@/lib/theme'
import { isNavItemActive } from '@/lib/nav-items'
import { useVisibleNavItems } from './settings/use-visible-nav-items'

export default function MobileBottomNav() {
  const pathname = usePathname()
  const items = useVisibleNavItems()
  const activeRef = useRef<HTMLAnchorElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  // True while more items sit off-screen to the right, so the fade + chevron
  // only show when there is something left to scroll to.
  const [moreAhead, setMoreAhead] = useState(false)

  const measure = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setMoreAhead(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
    measure()
  }, [pathname, items, measure])

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface-container-lowest pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div
        ref={scrollerRef}
        onScroll={measure}
        className="flex h-16 snap-x snap-mandatory items-center gap-1 overflow-x-auto px-2 [scrollbar-width:none]"
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
              className={`flex min-h-12 min-w-16 shrink-0 snap-center flex-col items-center justify-center gap-0.5 rounded-xl px-2 transition-colors duration-200 ${
                active ? `bg-surface-container-high ${accentText}` : 'text-on-surface-variant'
              }`}
            >
              <Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
              <span className="font-display text-xs font-semibold tracking-wide">{label}</span>
            </Link>
          )
        })}
      </div>
      {moreAhead && (
        <div
          aria-hidden
          data-testid="bottom-nav-more"
          className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-end bg-gradient-to-l from-surface-container-lowest via-surface-container-lowest/90 to-transparent pr-1 text-on-surface-variant"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2} />
        </div>
      )}
    </nav>
  )
}
