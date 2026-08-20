'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Account } from '@/lib/types'

export interface NewManualAccountValues {
  name: string
  opening_balance_minor_units: number
  currency: string
}

export interface UseAccountsResult {
  accounts: Account[]
  loading: boolean
  error: string | null
  refresh: () => void
  createManualAccount: (values: NewManualAccountValues) => Promise<Account | null>
  updateManualAccount: (id: string, patch: Partial<NewManualAccountValues & { name: string }>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  toggleHidden: (id: string) => Promise<void>
}

// Every account (Starling and manual) for the signed-in user — Starling
// rows are created/reconciled server-side by the sync route, never by
// this hook; createManualAccount/updateManualAccount only ever touch
// source: 'manual' rows. All mutations are optimistic with rollback,
// matching lib/daily-goals/use-todos.ts's established shape.
export function useAccounts(): UseAccountsResult {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setError(null)
          setAccounts((data ?? []) as Account[])
        }
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createManualAccount = useCallback(async (values: NewManualAccountValues) => {
    const { data, error: insertError } = await supabase
      .from('accounts')
      .insert({ ...values, source: 'manual' })
      .select()
      .single()

    if (insertError || !data) {
      setError(insertError?.message ?? 'Failed to create account')
      return null
    }

    setError(null)
    const created = data as Account
    setAccounts((prev) => [...prev, created])
    return created
  }, [])

  const updateManualAccount = useCallback(
    async (id: string, patch: Partial<NewManualAccountValues & { name: string }>) => {
      const target = accounts.find((a) => a.id === id)
      if (!target) return

      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
      setError(null)

      const { error: updateError } = await supabase.from('accounts').update(patch).eq('id', id)

      if (updateError) {
        setAccounts((prev) => prev.map((a) => (a.id === id ? target : a)))
        setError(updateError.message)
      }
    },
    [accounts]
  )

  const deleteAccount = useCallback(
    async (id: string) => {
      const index = accounts.findIndex((a) => a.id === id)
      if (index === -1) return
      const target = accounts[index]

      setAccounts((prev) => prev.filter((a) => a.id !== id))
      setError(null)

      const { error: deleteError } = await supabase.from('accounts').delete().eq('id', id)

      if (deleteError) {
        setAccounts((prev) => {
          const next = [...prev]
          next.splice(index, 0, target)
          return next
        })
        setError(deleteError.message)
      }
    },
    [accounts]
  )

  const togglePin = useCallback(
    async (id: string) => {
      const target = accounts.find((a) => a.id === id)
      if (!target) return
      const nextPinned = !target.is_pinned

      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, is_pinned: nextPinned } : a)))
      setError(null)

      const { error: updateError } = await supabase
        .from('accounts')
        .update({ is_pinned: nextPinned })
        .eq('id', id)

      if (updateError) {
        setAccounts((prev) => prev.map((a) => (a.id === id ? target : a)))
        setError(updateError.message)
      }
    },
    [accounts]
  )

  const toggleHidden = useCallback(
    async (id: string) => {
      const target = accounts.find((a) => a.id === id)
      if (!target) return
      const nextHidden = !target.is_hidden

      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, is_hidden: nextHidden } : a)))
      setError(null)

      const { error: updateError } = await supabase
        .from('accounts')
        .update({ is_hidden: nextHidden })
        .eq('id', id)

      if (updateError) {
        setAccounts((prev) => prev.map((a) => (a.id === id ? target : a)))
        setError(updateError.message)
      }
    },
    [accounts]
  )

  return {
    accounts,
    loading,
    error,
    refresh,
    createManualAccount,
    updateManualAccount,
    deleteAccount,
    togglePin,
    toggleHidden,
  }
}
