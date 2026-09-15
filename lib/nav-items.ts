import { Home, GraduationCap, DollarSign, FileSearch, ListChecks, ListTodo, CalendarDays, Contact, Brain, BookOpen, LayoutGrid } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { MODULE_ACCENT } from '@/lib/theme'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  module: keyof typeof MODULE_ACCENT
  matchPrefixes?: string[]
}

export const navItems: NavItem[] = [
  { href: '/', label: 'Home', icon: Home, module: 'home' },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, module: 'calendar' },
  { href: '/education', label: 'Education', icon: GraduationCap, module: 'education' },
  { href: '/money', label: 'Money', icon: DollarSign, module: 'money' },
  { href: '/research', label: 'Research', icon: FileSearch, module: 'research' },
  { href: '/habits', label: 'Tasks', icon: ListChecks, module: 'habits' },
  { href: '/people', label: 'People', icon: Contact, module: 'people' },
  { href: '/bible', label: 'Bible', icon: BookOpen, module: 'bible' },
  { href: '/brain-dump', label: 'Brain Dump', icon: Brain, module: 'todos' },
  { href: '/apps', label: 'App Library', icon: LayoutGrid, module: 'apps' },
]
