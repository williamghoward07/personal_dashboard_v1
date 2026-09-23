'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useSettings, type UseSettingsResult } from '@/lib/settings/use-settings'
import { defaultSettings } from '@/lib/settings/schema'

/**
 * One `useSettings()` instance for the whole shell.
 *
 * `useSettings()` is per-call state, and its write path upserts the entire
 * row, so two independent instances would (a) not see each other's changes
 * and (b) let the second write clobber the first's columns. The settings
 * menu, the rail and the mobile bar all read/write `hidden_nav_items`, so
 * they share this one.
 */
const SettingsContext = createContext<UseSettingsResult | null>(null)

const FALLBACK: UseSettingsResult = {
  settings: defaultSettings(),
  loading: false,
  error: null,
  refresh: () => {},
  updateSettings: async () => {},
}

export default function SettingsProvider({ children }: { children: ReactNode }) {
  const value = useSettings()
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

/**
 * The shell's shared settings. Outside the provider (the login page, or a
 * component rendered in isolation in a test) this returns inert defaults
 * rather than throwing, matching how `useSettings` itself degrades when the
 * hand-applied `user_settings` migration has not been run yet.
 */
export function useAppSettings(): UseSettingsResult {
  return useContext(SettingsContext) ?? FALLBACK
}
