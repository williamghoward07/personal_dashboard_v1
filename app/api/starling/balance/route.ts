import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAccounts, getAccountBalance, getSpaces } from '@/lib/starling/client'

// One entry per Starling account rather than a single summed figure — the
// Money page renders one card per account (see AccountCard), matched to
// its accounts row via externalId (Starling's accountUid).
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  if (!process.env.STARLING_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'starling_not_configured' }, { status: 503 })
  }

  try {
    const accounts = await getAccounts()
    const balances = await Promise.all(accounts.map((a) => getAccountBalance(a.accountUid)))
    const spaces = await Promise.all(accounts.map((a) => getSpaces(a.accountUid)))

    return NextResponse.json({
      accounts: accounts.map((account, i) => ({
        externalId: account.accountUid,
        name: account.name || account.accountType,
        // totalEffectiveBalance (not effectiveBalance) — includes money
        // parked in this account's Spaces, since Spaces are shown as a
        // breakdown of this total rather than added to it separately.
        minorUnits: balances[i].totalEffectiveBalance.minorUnits,
        currency: balances[i].totalEffectiveBalance.currency,
        spaces: spaces[i]
          .filter((s) => s.state === 'ACTIVE')
          .map((s) => ({
            externalId: s.spaceUid,
            name: s.name,
            minorUnits: s.amount.minorUnits,
            currency: s.amount.currency,
            spaceType: s.spaceType,
          })),
      })),
    })
  } catch (err) {
    console.error('Starling balance fetch failed:', err)
    return NextResponse.json({ error: 'starling_balance_failed' }, { status: 502 })
  }
}
