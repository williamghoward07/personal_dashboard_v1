'use client'

import { useCallback, useEffect, useState } from 'react'

export interface StarlingSpaceBalance {
  externalId: string
  name: string
  minorUnits: number
  currency: string
  spaceType: 'savings_goal' | 'spending_space'
}

export interface StarlingAccountBalance {
  externalId: string
  name: string
  // Includes money held in this account's Spaces (see `spaces` below) —
  // Spaces are a breakdown of this figure, not additional to it.
  minorUnits: number
  currency: string
  spaces: StarlingSpaceBalance[]
}

export type StarlingBalancesState =
  | { status: 'loading' }
  | { status: 'ready'; balances: StarlingAccountBalance[] }
  | { status: 'not_connected' }
  | { status: 'error' }

// One entry per Starling account (see app/api/starling/balance/route.ts) —
// shared between the main Money page and an account's detail page rather
// than each doing its own fetch. Returned as { state, refresh } rather
// than a spread union so callers keep full discriminated-union narrowing
// on `state.status`.
export function useStarlingBalances(): { state: StarlingBalancesState; refresh: () => void } {
  const [state, setState] = useState<StarlingBalancesState>({ status: 'loading' })

  const refresh = useCallback(() => {
    fetch('/api/starling/balance')
      .then(async (res) => {
        if (res.status === 503) return setState({ status: 'not_connected' })
        if (!res.ok) return setState({ status: 'error' })
        const data = await res.json()
        setState({ status: 'ready', balances: (data.accounts ?? []) as StarlingAccountBalance[] })
      })
      .catch(() => setState({ status: 'error' }))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { state, refresh }
}
