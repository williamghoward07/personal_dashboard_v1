'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ACCENT_TEXT, MODULE_ACCENT } from '@/lib/theme'
import { navItems } from '@/lib/nav-items'

export default function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center gap-1 overflow-x-auto border-t border-outline-variant bg-surface px-2 md:hidden">
      {navItems.map(({ href, label, icon: Icon, module, matchPrefixes }) => {
        const active =
          href === '/' ? pathname === '/' : (matchPrefixes ?? [href]).some((prefix) => pathname.startsWith(prefix))
        const accentText = ACCENT_TEXT[MODULE_ACCENT[module]]
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors duration-200 ${
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
