'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { defaultSettings, parseUserSettings, type UserSettings } from './schema'

export type UserSettingsPatch = Partial<UserSettings>

export interface UseSettingsResult {
  settings: UserSettings
  loading: boolean
  error: string | null
  refresh: () => void
  updateSettings: (patch: UserSettingsPatch) => Promise<void>
}

const SELECT_COLUMNS = 'home_layout, hidden_nav_items, launcher_link_ids'

// `user_settings` (supabase/migrations/20260920000000_user_settings.sql) is
// applied by hand, per this repo's convention, so the table may not exist
// yet — or may exist with no row for this user — the first (or every) time
// this hook runs. Any read failure falls back to schema.ts's defaults
// silently: a missing migration must never be the thing that breaks the
// settings-dependent UI (home layout, nav visibility, the launcher).
//
// The write path (optimistic update, then persist, then roll back +
// surface an error on failure) follows lib/workspaces/use-workspaces.ts:87-101
// exactly.
export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    supabase
      .from('user_settings')
      .select(SELECT_COLUMNS)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        // fetchError covers: table doesn't exist yet, no permission, or
        // any other read failure. In every case, fall back to defaults
        // rather than surfacing an error — this is expected until the
        // migration is applied by hand.
        setSettings(fetchError ? defaultSettings() : parseUserSettings(data))
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateSettings = useCallback(
    async (patch: UserSettingsPatch) => {
      const previous = settings
      const next: UserSettings = { ...previous, ...patch }
      setSettings(next)
      setError(null)

      const { error: upsertError } = await supabase
        .from('user_settings')
        .upsert({ ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

      if (upsertError) {
        setSettings(previous)
        setError(upsertError.message)
      }
    },
    [settings]
  )

  return { settings, loading, error, refresh, updateSettings }
}
