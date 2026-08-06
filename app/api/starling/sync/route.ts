import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccounts, getTransactionsBetween, type StarlingFeedItem } from '@/lib/starling/client'
import { isSuccessfulStarlingStatus } from '@/lib/money'

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

    const rows = (
      await Promise.all(
        accounts.map(async (account) => {
          const feedItems = await getTransactionsBetween(
            account.accountUid,
            account.defaultCategory,
            minTransactionTimestamp,
            maxTransactionTimestamp
          )

          return feedItems
            .filter((item) => isSuccessfulStarlingStatus(item.status))
            .map((item) => ({
              user_id: user.id,
              source: 'starling',
              external_id: item.feedItemUid,
              account_label: account.name || account.accountType,
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
