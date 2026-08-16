import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getAccountInfo,
  getCash,
  getPortfolio,
  getInstruments,
  Trading212ConfigError,
} from '@/lib/trading212/client'

// Trading 212's docs don't commit to number vs numeric-string for money
// fields — coerce defensively rather than trusting the declared TS type,
// since that type is itself a guess pending live verification (see below).
function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    // Trading 212 enforces a per-endpoint, per-key rate limit tight enough
    // (as little as 1 request per 2s) that firing these concurrently gets
    // 2 of 3 rejected with 401/403 — confirmed by hitting the live API
    // directly. Sequential awaits give each request room to clear.
    const accountInfo = await getAccountInfo()
    const cash = await getCash()
    const positions = await getPortfolio()

    // Logged so the raw shape can be sanity-checked against real field
    // names/types before trusting the formatting below.
    console.log('[trading212] raw account info:', JSON.stringify(accountInfo))
    console.log('[trading212] raw cash:', JSON.stringify(cash))
    console.log('[trading212] raw portfolio:', JSON.stringify(positions))

    const primaryCurrency = accountInfo.currencyCode

    const tickers = [...new Set(positions.map((p) => p.ticker))]
    let currencyByTicker = new Map<string, string>()
    if (tickers.length > 0) {
      try {
        const instruments = await getInstruments()
        currencyByTicker = new Map(instruments.map((i) => [i.ticker, i.currencyCode]))
      } catch (err) {
        // Non-fatal — the widget just won't be able to flag foreign-currency
        // positions if the instrument list can't be fetched.
        console.error('Trading 212 instrument metadata fetch failed:', err)
      }
    }

    const formattedPositions = positions.map((p) => {
      const currencyCode = currencyByTicker.get(p.ticker) ?? null
      return {
        ticker: p.ticker,
        quantity: toNumber(p.quantity),
        averagePrice: toNumber(p.averagePrice),
        currentPrice: toNumber(p.currentPrice),
        ppl: toNumber(p.ppl),
        currencyCode,
        isForeignCurrency: currencyCode != null && currencyCode !== primaryCurrency,
      }
    })

    return NextResponse.json({
      primaryCurrency,
      cash: {
        free: toNumber(cash.free),
        invested: toNumber(cash.invested),
        blocked: toNumber(cash.blocked),
        total: toNumber(cash.total),
      },
      positions: formattedPositions,
    })
  } catch (err) {
    if (err instanceof Trading212ConfigError) {
      return NextResponse.json({ error: 'trading212_not_configured' }, { status: 503 })
    }
    console.error('Trading 212 snapshot fetch failed:', err)
    return NextResponse.json({ error: 'trading212_unavailable' }, { status: 502 })
  }
}
