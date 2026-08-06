import 'server-only'

// Read-only API key, Basic-auth over HTTPS — see TRADING212_API_KEY /
// TRADING212_API_SECRET in .env.local. Scoped to Account data, Metadata,
// History, Orders-Read, Pies-Read; no order-placement calls exist here.
const TRADING212_API_BASE = 'https://live.trading212.com/api/v0'

// Thrown for missing env vars AND a 401 from Trading 212 itself — both mean
// "we can't authenticate", which the route surfaces as "not connected"
// rather than a generic upstream failure.
export class Trading212ConfigError extends Error {}

export class Trading212ApiError extends Error {
  status: number
  constructor(status: number, path: string) {
    super(`Trading 212 API error: ${status} ${path}`)
    this.status = status
  }
}

async function trading212Fetch<T>(path: string): Promise<T> {
  const apiKey = process.env.TRADING212_API_KEY
  const apiSecret = process.env.TRADING212_API_SECRET
  if (!apiKey || !apiSecret) {
    throw new Trading212ConfigError('TRADING212_API_KEY/TRADING212_API_SECRET are not configured')
  }

  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  const res = await fetch(new URL(path, TRADING212_API_BASE), {
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (res.status === 401) {
    throw new Trading212ConfigError(`Trading 212 rejected credentials: 401 ${path}`)
  }
  if (!res.ok) {
    throw new Trading212ApiError(res.status, path)
  }

  return res.json() as Promise<T>
}

// Raw response shapes are typed loosely (unknown-ish) on purpose until we've
// confirmed real field names/types against a live account — see the
// snapshot route, which logs the raw JSON before any formatting happens.
export interface Trading212AccountInfo {
  currencyCode: string
  id: number
}

export interface Trading212Cash {
  free: number
  total: number
  invested: number
  blocked: number | null
  pieCash: number
  ppl: number
  result: number
}

export interface Trading212Position {
  ticker: string
  quantity: number
  averagePrice: number
  currentPrice: number
  ppl: number
  fxPpl?: number | null
  initialFillDate?: string
  maxBuy?: number
  maxSell?: number
  pieQuantity?: number
}

export interface Trading212Instrument {
  ticker: string
  currencyCode: string
  name: string
}

export function getAccountInfo(): Promise<Trading212AccountInfo> {
  return trading212Fetch<Trading212AccountInfo>('/equity/account/info')
}

export function getCash(): Promise<Trading212Cash> {
  return trading212Fetch<Trading212Cash>('/equity/account/cash')
}

export function getPortfolio(): Promise<Trading212Position[]> {
  return trading212Fetch<Trading212Position[]>('/equity/portfolio')
}

// Full instrument universe, no per-ticker lookup exists in v0 — used only to
// map the (small) set of held tickers to their native currency so the
// widget can flag positions Trading 212 won't convert to the account's
// primary currency.
export function getInstruments(): Promise<Trading212Instrument[]> {
  return trading212Fetch<Trading212Instrument[]>('/equity/metadata/instruments')
}
