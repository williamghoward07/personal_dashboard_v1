import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAccounts, getAccountBalance } from '@/lib/starling/client'

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

    const currency = balances[0]?.effectiveBalance.currency ?? 'GBP'
    const minorUnits = balances.reduce((sum, b) => sum + b.effectiveBalance.minorUnits, 0)

    return NextResponse.json({ minorUnits, currency })
  } catch (err) {
    console.error('Starling balance fetch failed:', err)
    return NextResponse.json({ error: 'starling_balance_failed' }, { status: 502 })
  }
}
