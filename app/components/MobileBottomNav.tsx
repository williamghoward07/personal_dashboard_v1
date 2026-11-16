'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Ellipsis } from 'lucide-react'
import { ACCENT_TEXT, MODULE_ACCENT } from '@/lib/theme'
import { isNavItemActive } from '@/lib/nav-items'
import { useVisibleNavItems } from './settings/use-visible-nav-items'
import MobileMoreSheet from './MobileMoreSheet'

const BAR_SLOTS = 5

const SLOT_CLASS =
  'relative flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 transition-colors duration-200'

export default function MobileBottomNav() {
  const pathname = usePathname()
  const items = useVisibleNavItems()
  const [sheetOpen, setSheetOpen] = useState(false)
  const moreRef = useRef<HTMLButtonElement | null>(null)

  const hasOverflow = items.length > BAR_SLOTS
  const barItems = hasOverflow ? items.slice(0, BAR_SLOTS - 1) : items
  const overflow = hasOverflow ? items.slice(BAR_SLOTS - 1) : []
  const moreActive = overflow.some((item) => isNavItemActive(item, pathname))

  const closeSheet = () => {
    setSheetOpen(false)
    moreRef.current?.focus()
  }

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface-container-lowest pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex">
        {barItems.map((item) => {
          const { href, label, icon: Icon, module } = item
          const active = isNavItemActive(item, pathname)
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={active ? 'page' : undefined}
              className={`${SLOT_CLASS} ${
                active ? ACCENT_TEXT[MODULE_ACCENT[module]] : 'text-on-surface-variant'
              }`}
            >
              {active && <span aria-hidden className="absolute inset-x-6 top-0 h-0.5 rounded-b-full bg-current" />}
              <Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
              <span className="w-full truncate text-center font-display text-xs font-semibold tracking-wide">{label}</span>
            </Link>
          )
        })}
        {hasOverflow && (
          <button
            type="button"
            ref={moreRef}
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            title="More"
            className={`${SLOT_CLASS} ${moreActive ? ACCENT_TEXT.mint : 'text-on-surface-variant'}`}
          >
            {moreActive && <span aria-hidden className="absolute inset-x-6 top-0 h-0.5 rounded-b-full bg-current" />}
            <Ellipsis aria-hidden className="h-6 w-6" strokeWidth={1.75} />
            <span className="w-full truncate text-center font-display text-xs font-semibold tracking-wide">More</span>
          </button>
        )}
      </div>
      {sheetOpen && <MobileMoreSheet items={overflow} pathname={pathname} onClose={closeSheet} />}
    </nav>
  )
}
