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
  return useMemo(() => visibleNavItems(hidden), [hidden])
}
