'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

function key(accountId: string, spaceExternalId: string): string {
  return `${accountId}:${spaceExternalId}`
}

// A hidden Starling Space (pot) is represented by row presence in
// starling_hidden_spaces, not a boolean flag — no row = visible, a row =
// hidden. This hook loads the full hidden set once and exposes a plain
// lookup plus an optimistic insert/delete toggle, matching
// lib/money/use-accounts.ts's established shape.
export function useSpacePreferences() {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    supabase
      .from('starling_hidden_spaces')
      .select('account_id, space_external_id')
      .then(({ data }) => {
        setHiddenKeys(new Set((data ?? []).map((row) => key(row.account_id, row.space_external_id))))
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const isHidden = useCallback(
    (accountId: string, spaceExternalId: string) => hiddenKeys.has(key(accountId, spaceExternalId)),
    [hiddenKeys]
  )

  const toggleHidden = useCallback(
    async (accountId: string, spaceExternalId: string) => {
      const k = key(accountId, spaceExternalId)
      const wasHidden = hiddenKeys.has(k)

      setHiddenKeys((prev) => {
        const next = new Set(prev)
        if (wasHidden) next.delete(k)
        else next.add(k)
        return next
      })

      const { error } = wasHidden
        ? await supabase
            .from('starling_hidden_spaces')
            .delete()
            .eq('account_id', accountId)
            .eq('space_external_id', spaceExternalId)
        : await supabase
            .from('starling_hidden_spaces')
            .insert({ account_id: accountId, space_external_id: spaceExternalId })

      if (error) {
        setHiddenKeys((prev) => {
          const next = new Set(prev)
          if (wasHidden) next.add(k)
          else next.delete(k)
          return next
        })
      }
    },
    [hiddenKeys]
  )

  return { loading, isHidden, toggleHidden }
}
