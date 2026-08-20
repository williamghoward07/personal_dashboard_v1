import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getAccounts,
  getSpaces,
  getTransactionsBetween,
  type StarlingAccount,
  type StarlingFeedItem,
} from '@/lib/starling/client'
import { isPendingStarlingStatus } from '@/lib/money'

const FIRST_SYNC_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000

function categoryFromSpendingCategory(spendingCategory: string | undefined) {
  if (!spendingCategory) return 'Other'
  return spendingCategory
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Whitelisted rather than dumping the feed item — Starling's feed payload
// doesn't carry account numbers or sort codes today, but listing exactly
// the fields we keep means a future API addition can't leak one into raw.
function toRawPayload(item: StarlingFeedItem) {
  return {
    feedItemUid: item.feedItemUid,
    categoryUid: item.categoryUid,
    amount: item.amount,
    sourceAmount: item.sourceAmount,
    direction: item.direction,
    updatedAt: item.updatedAt,
    transactionTime: item.transactionTime,
    settlementTime: item.settlementTime ?? null,
    source: item.source,
    status: item.status,
    counterPartyType: item.counterPartyType ?? null,
    counterPartyName: item.counterPartyName ?? null,
    reference: item.reference ?? null,
    country: item.country ?? null,
    spendingCategory: item.spendingCategory ?? null,
  }
}

type AdminClient = ReturnType<typeof createAdminClient>

// Resolves a Starling account to its `accounts` row id, creating or
// reconciling one as needed. Tries the stable Starling id first; falls
// back to matching an un-linked row by name (the 20260816020000
// migration backfilled accounts from historical account_label text with
// external_id left null, since that id was never captured before this
// change) and fills in its external_id rather than inserting a duplicate
// for the same real-world account. That fallback only ever matters once,
// right after the migration ships — every sync after that hits the
// external_id lookup directly.
async function resolveAccountId(admin: AdminClient, userId: string, starlingAccount: StarlingAccount): Promise<string> {
  const name = starlingAccount.name || starlingAccount.accountType

  const { data: byExternalId } = await admin
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'starling')
    .eq('external_id', starlingAccount.accountUid)
    .maybeSingle()

  if (byExternalId) return byExternalId.id

  const { data: byName } = await admin
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'starling')
    .is('external_id', null)
    .eq('name', name)
    .maybeSingle()

  if (byName) {
    await admin.from('accounts').update({ external_id: starlingAccount.accountUid }).eq('id', byName.id)
    return byName.id
  }

  const { data: created, error: insertError } = await admin
    .from('accounts')
    .insert({
      user_id: userId,
      name,
      source: 'starling',
      external_id: starlingAccount.accountUid,
      currency: starlingAccount.currency,
    })
    .select('id')
    .single()

  if (insertError || !created) {
    throw new Error(insertError?.message ?? 'Failed to create account for Starling sync')
  }

  return created.id
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: integration } = await admin
    .from('integrations')
    .select('last_synced_at')
    .eq('provider', 'starling')
    .eq('user_id', user.id)
    .maybeSingle()

  const minTransactionTimestamp =
    integration?.last_synced_at ?? new Date(Date.now() - FIRST_SYNC_LOOKBACK_MS).toISOString()
  const maxTransactionTimestamp = new Date().toISOString()

  try {
    const accounts = await getAccounts()
    const accountIds = await Promise.all(
      accounts.map((account) => resolveAccountId(admin, user.id, account))
    )

    const rows = (
      await Promise.all(
        accounts.map(async (account, i) => {
          const feedItems = await getTransactionsBetween(
            account.accountUid,
            account.defaultCategory,
            minTransactionTimestamp,
            maxTransactionTimestamp
          )

          // Standing orders that haven't fired yet are skipped outright;
          // declined/reversed/retracted/zero-value items are still stored
          // so the transactions list can show them (styled red) rather
          // than silently dropping them.
          return feedItems
            .filter((item) => !isPendingStarlingStatus(item.status))
            .map((item) => ({
              user_id: user.id,
              source: 'starling',
              external_id: item.feedItemUid,
              account_label: account.name || account.accountType,
              account_id: accountIds[i],
              merchant_name: item.counterPartyName ?? null,
              amount_minor_units: item.amount.minorUnits,
              type: item.direction === 'IN' ? 'income' : 'outgoing',
              category: categoryFromSpendingCategory(item.spendingCategory),
              description: item.reference ?? null,
              date: item.transactionTime.slice(0, 10),
              raw: toRawPayload(item),
            }))
        })
      )
    ).flat()

    if (rows.length > 0) {
      const { error: upsertError } = await admin.rpc('upsert_synced_transactions', { rows })
      if (upsertError) throw upsertError
    }

    // Purely for future history — app/api/starling/balance/route.ts fetches
    // Spaces live for what's actually displayed, so a failure/delay here
    // never affects what the user sees, just how much history accumulates.
    const spaceSnapshotRows = (
      await Promise.all(
        accounts.map(async (account, i) => {
          const spaces = await getSpaces(account.accountUid)
          return spaces
            .filter((s) => s.state === 'ACTIVE')
            .map((s) => ({
              user_id: user.id,
              account_id: accountIds[i],
              space_external_id: s.spaceUid,
              space_type: s.spaceType,
              name: s.name,
              currency: s.amount.currency,
              minor_units: s.amount.minorUnits,
              state: s.state,
            }))
        })
      )
    ).flat()

    if (spaceSnapshotRows.length > 0) {
      const { error: spaceSnapshotError } = await admin.from('starling_space_snapshots').insert(spaceSnapshotRows)
      if (spaceSnapshotError) throw spaceSnapshotError
    }

    await admin.from('integrations').upsert(
      {
        user_id: user.id,
        provider: 'starling',
        last_synced_at: maxTransactionTimestamp,
        last_error: null,
      },
      { onConflict: 'user_id,provider' }
    )

    return NextResponse.json({ synced: rows.length })
  } catch (err) {
    // Postgrest/RPC errors are plain objects with a `message`, not Error
    // instances — fall back through both shapes rather than losing the
    // real reason behind a generic string.
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'sync_failed'

    console.error('Starling sync failed:', err)

    await admin.from('integrations').upsert(
      {
        user_id: user.id,
        provider: 'starling',
        last_error: message,
      },
      { onConflict: 'user_id,provider' }
    )
    return NextResponse.json({ error: 'starling_sync_failed' }, { status: 502 })
  }
}
