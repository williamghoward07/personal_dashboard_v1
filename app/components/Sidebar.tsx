import Link from 'next/link'
import { Home, Heart, GraduationCap, DollarSign, FileSearch, ListChecks } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/health', label: 'Health', icon: Heart },
  { href: '/education', label: 'Education', icon: GraduationCap },
  { href: '/money', label: 'Money', icon: DollarSign },
  { href: '/research', label: 'Research', icon: FileSearch },
  { href: '/habits', label: 'Habit tracker', icon: ListChecks },
]

export default function Sidebar() {
  return (
    <nav className="flex h-full w-16 flex-col items-center gap-2 border-r border-black/10 py-6 dark:border-white/10">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          title={label}
          aria-label={label}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-black/60 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <Icon className="h-5 w-5" />
        </Link>
      ))}
    </nav>
  )
}
