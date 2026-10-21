import {
  Home,
  GraduationCap,
  DollarSign,
  FileSearch,
  ListChecks,
  ListTodo,
  Gauge,
  CalendarDays,
  Contact,
  Brain,
  BookOpen,
  LayoutGrid,
  FolderKanban,
  Presentation,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { MODULE_ACCENT } from '@/lib/theme'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  module: keyof typeof MODULE_ACCENT
  matchPrefixes?: string[]
  /**
   * A real route that is off the rail until the user switches it on in
   * Settings. `/todos` and `/ai-usage` are reachable today only by typing
   * the URL or following an in-page link; they are listed here so they can
   * be promoted to the rail without another code change.
   */
  hiddenByDefault?: boolean
}

/** Home is pinned: it is the only guaranteed way back, so it can't be hidden. */
export const HOME_HREF = '/'

export const navItems: NavItem[] = [
  { href: '/', label: 'Home', icon: Home, module: 'home' },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, module: 'calendar' },
  { href: '/education', label: 'Education', icon: GraduationCap, module: 'education' },
  { href: '/lectures', label: 'Lectures', icon: Presentation, module: 'education' },
  { href: '/workspaces', label: 'Workspaces', icon: FolderKanban, module: 'workspaces' },
  { href: '/money', label: 'Money', icon: DollarSign, module: 'money' },
  { href: '/research', label: 'Research', icon: FileSearch, module: 'research' },
  { href: '/habits', label: 'Tasks', icon: ListChecks, module: 'habits' },
  { href: '/todos', label: 'Todos', icon: ListTodo, module: 'todos', hiddenByDefault: true },
  { href: '/people', label: 'People', icon: Contact, module: 'people' },
  { href: '/bible', label: 'Bible', icon: BookOpen, module: 'bible' },
  { href: '/brain-dump', label: 'Brain Dump', icon: Brain, module: 'todos' },
  { href: '/apps', label: 'App Library', icon: LayoutGrid, module: 'apps' },
  { href: '/ai-usage', label: 'AI Usage', icon: Gauge, module: 'home', hiddenByDefault: true },
]

/** Is `pathname` inside this nav item's section? */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === HOME_HREF) return pathname === HOME_HREF
  return (item.matchPrefixes ?? [item.href]).some((prefix) => pathname.startsWith(prefix))
}

/**
 * The nav item `pathname` belongs to, or null for a route with no tab
 * (`/login`, `/design-system-test`). The longest matching href wins, so a
 * nested section never loses to a shorter prefix.
 */
export function activeNavItem(pathname: string): NavItem | null {
  let best: NavItem | null = null
  for (const item of navItems) {
    if (!isNavItemActive(item, pathname)) continue
    if (!best || item.href.length > best.href.length) best = item
  }
  return best
}

/**
 * `user_settings.hidden_nav_items` holds one entry per item the user has
 * moved *off* its default: a bare href hides a normally-visible tab, and a
 * `show:` token reveals a `hiddenByDefault` one. Two encodings in one array
 * (rather than a second column) because the field name still tells the
 * truth — everything without the prefix is a hidden href — and because
 * `lib/settings/schema.ts` treats it as an opaque string list.
 */
const SHOW_OVERRIDE_PREFIX = 'show:'

/** The `hidden_nav_items` entry meaning "this default-hidden tab is on". */
export function showOverrideToken(href: string): string {
  return `${SHOW_OVERRIDE_PREFIX}${href}`
}

/** Home is always on the rail; everything else is the user's choice. */
export function canHideNavItem(item: NavItem): boolean {
  return item.href !== HOME_HREF
}

export function isNavItemVisible(item: NavItem, hiddenNavItems: readonly string[]): boolean {
  if (!canHideNavItem(item)) return true
  if (item.hiddenByDefault) return hiddenNavItems.includes(showOverrideToken(item.href))
  return !hiddenNavItems.includes(item.href)
}

/** The nav items to render, in `navItems` order. */
export function visibleNavItems(hiddenNavItems: readonly string[]): NavItem[] {
  return navItems.filter((item) => isNavItemVisible(item, hiddenNavItems))
}

/**
 * The next `hidden_nav_items` after showing/hiding one tab. Always drops
 * both encodings for that href first, so the array can never hold a
 * contradictory pair, and never grows an entry for an item left at its
 * default.
 */
export function setNavItemVisibility(
  hiddenNavItems: readonly string[],
  item: NavItem,
  visible: boolean
): string[] {
  const token = showOverrideToken(item.href)
  const next = hiddenNavItems.filter((entry) => entry !== item.href && entry !== token)
  if (!canHideNavItem(item)) return next
  if (item.hiddenByDefault) {
    if (visible) next.push(token)
  } else if (!visible) {
    next.push(item.href)
  }
  return next
}
