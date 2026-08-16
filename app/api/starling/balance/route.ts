import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAccounts, getAccountBalance } from '@/lib/starling/client'

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

    return NextResponse.json({
      accounts: accounts.map((account, i) => ({
        externalId: account.accountUid,
        name: account.name || account.accountType,
        minorUnits: balances[i].effectiveBalance.minorUnits,
        currency: balances[i].effectiveBalance.currency,
      })),
    })
  } catch (err) {
    console.error('Starling balance fetch failed:', err)
    return NextResponse.json({ error: 'starling_balance_failed' }, { status: 502 })
  }
}
