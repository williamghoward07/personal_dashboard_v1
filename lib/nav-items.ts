import { Home, Heart, GraduationCap, DollarSign, FileSearch, ListChecks, ListTodo, CalendarDays, Contact } from 'lucide-react'
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
  { href: '/health', label: 'Health', icon: Heart, module: 'health' },
  { href: '/education', label: 'Education', icon: GraduationCap, module: 'education' },
  { href: '/money', label: 'Money', icon: DollarSign, module: 'money' },
  { href: '/research', label: 'Research', icon: FileSearch, module: 'research' },
  { href: '/habits', label: 'Tasks', icon: ListChecks, module: 'habits' },
  { href: '/todos', label: 'Todos', icon: ListTodo, module: 'todos' },
  { href: '/people', label: 'People', icon: Contact, module: 'people' },
]
