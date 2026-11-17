'use client'

import { useMemo } from 'react'
import { visibleNavItems, type NavItem } from '@/lib/nav-items'
import { useAppSettings } from './SettingsProvider'

/**
 * The nav items to render, honouring `user_settings.hidden_nav_items`.
 * Shared by `Sidebar` and `MobileBottomNav` so the rail and the mobile bar
 * can never disagree about which tabs exist.
 */
export function useVisibleNavItems(): NavItem[] {
  const { settings } = useAppSettings()
  const hidden = settings.hidden_nav_items
  return useMemo(() => {
    const items = visibleNavItems(hidden)
    // Todos is a tab inside Tasks unless the user explicitly promotes its
    // standalone navigation entry. Keep the active marker on that section.
    if (items.some((item) => item.href === '/todos')) return items
    return items.map((item) => item.href === '/habits'
      ? { ...item, matchPrefixes: ['/habits', '/todos'] }
      : item)
  }, [hidden])
}
