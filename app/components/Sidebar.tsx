'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Heart, GraduationCap, DollarSign, FileSearch, ListChecks, Hexagon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ACCENT_TEXT, MODULE_ACCENT } from '@/lib/theme'

const navItems: { href: string; label: string; icon: LucideIcon; module: keyof typeof MODULE_ACCENT }[] = [
  { href: '/', label: 'Home', icon: Home, module: 'home' },
  { href: '/health', label: 'Health', icon: Heart, module: 'health' },
  { href: '/education', label: 'Education', icon: GraduationCap, module: 'education' },
  { href: '/money', label: 'Money', icon: DollarSign, module: 'money' },
  { href: '/research', label: 'Research', icon: FileSearch, module: 'research' },
  { href: '/habits', label: 'Habits', icon: ListChecks, module: 'habits' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="fixed left-0 top-0 z-40 flex h-full w-20 flex-col items-center gap-6 border-r border-outline-variant bg-surface py-8">
      <Link href="/" aria-label="Study Copilot" className="text-secondary-container">
        <Hexagon className="h-7 w-7" strokeWidth={1.5} />
      </Link>

      <div className="flex flex-1 flex-col items-center gap-3">
        {navItems.map(({ href, label, icon: Icon, module }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          const accentText = ACCENT_TEXT[MODULE_ACCENT[module]]
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={`group flex flex-col items-center gap-1 rounded-xl p-3 transition-colors duration-200 ${
                active
                  ? `bg-surface-container-high ${accentText}`
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span
                className={`font-display text-[9px] font-semibold tracking-wide ${
                  active ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'
                }`}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
