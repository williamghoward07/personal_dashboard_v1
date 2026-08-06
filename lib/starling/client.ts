import 'server-only'

// Read-only personal access token, no OAuth/refresh flow — see
// STARLING_ACCESS_TOKEN in .env.local. Scoped to whatever account access
// the token was issued with.
const STARLING_API_BASE = 'https://api.starlingbank.com'

export interface StarlingAccount {
  accountUid: string
  accountType: string
  defaultCategory: string
  currency: string
  createdAt: string
  name: string
}

export interface StarlingAmount {
  currency: string
  minorUnits: number
}

export interface StarlingAccountBalance {
  clearedBalance: StarlingAmount
  effectiveBalance: StarlingAmount
  pendingTransactions: StarlingAmount
  acceptedOverdraft: StarlingAmount
  amount: StarlingAmount
  totalClearedBalance: StarlingAmount
  totalEffectiveBalance: StarlingAmount
}

export interface StarlingFeedItem {
  feedItemUid: string
  categoryUid: string
  amount: StarlingAmount
  sourceAmount: StarlingAmount
  direction: 'IN' | 'OUT'
  updatedAt: string
  transactionTime: string
  settlementTime?: string
  source: string
  status: string
  counterPartyType?: string
  counterPartyName?: string
  reference?: string
  country?: string
  spendingCategory?: string
}

async function starlingFetch<T>(
  path: string,
  searchParams?: Record<string, string>,
  revalidateSeconds?: number
): Promise<T> {
  const token = process.env.STARLING_ACCESS_TOKEN
  if (!token) {
    throw new Error('STARLING_ACCESS_TOKEN is not configured')
  }

  const url = new URL(path, STARLING_API_BASE)
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    url.searchParams.set(key, value)
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    ...(revalidateSeconds != null
      ? { next: { revalidate: revalidateSeconds } }
      : { cache: 'no-store' as const }),
  })

  if (!res.ok) {
    throw new Error(`Starling API error: ${res.status} ${path}`)
  }

  return res.json() as Promise<T>
}

// Balance is polled by more than one widget (home + money page) on every
// mount — a short revalidate window lets Next's fetch cache dedupe those
// instead of re-hitting Starling's balance endpoint every time, which trips
// its rate limit fast.
const BALANCE_REVALIDATE_SECONDS = 30

export async function getAccounts(): Promise<StarlingAccount[]> {
  const { accounts } = await starlingFetch<{ accounts: StarlingAccount[] }>(
    '/api/v2/accounts',
    undefined,
    BALANCE_REVALIDATE_SECONDS
  )
  return accounts
}

export async function getAccountBalance(accountUid: string): Promise<StarlingAccountBalance> {
  return starlingFetch<StarlingAccountBalance>(
    `/api/v2/accounts/${accountUid}/balance`,
    undefined,
    BALANCE_REVALIDATE_SECONDS
  )
}

// Starling's feed API is per-category, not per-account — accountUid's
// defaultCategory (returned alongside it from getAccounts) is the category
// that covers ordinary spending/income for that account.
export async function getTransactionsBetween(
  accountUid: string,
  categoryUid: string,
  minTransactionTimestamp: string,
  maxTransactionTimestamp: string
): Promise<StarlingFeedItem[]> {
  const { feedItems } = await starlingFetch<{ feedItems: StarlingFeedItem[] }>(
    `/api/v2/feed/account/${accountUid}/category/${categoryUid}/transactions-between`,
    { minTransactionTimestamp, maxTransactionTimestamp }
  )
  return feedItems
}
