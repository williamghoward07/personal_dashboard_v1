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

// Starling's Spaces are sub-pots nested inside an account (Savings
// Spaces/goals, and — unverified against real data, since this account
// has none active — Round Up/"spending" Spaces). Both shapes are
// normalized to one type; spendingSpaces fields are read defensively
// since their exact shape hasn't been observed live.
export interface StarlingSpace {
  spaceUid: string
  name: string
  spaceType: 'savings_goal' | 'spending_space'
  amount: StarlingAmount
  state: string | null
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

// Starling's rate limit is tight enough to trip in normal use — a Starling
// sync followed immediately by a balance refresh (as the Money page does
// today) fires ~18 calls in under a second and reliably gets a 429
// (confirmed live: Starling returns `Retry-After: 1` after roughly 10
// rapid calls). Retrying here, in the one function every Starling call
// goes through, means every caller gets this for free.
const MAX_RATE_LIMIT_RETRIES = 3
const DEFAULT_RETRY_DELAY_MS = 400

async function starlingFetch<T>(
  path: string,
  searchParams?: Record<string, string>,
  revalidateSeconds?: number,
  attempt = 0
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

  if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
    const retryAfterSeconds = Number(res.headers.get('retry-after'))
    const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : DEFAULT_RETRY_DELAY_MS
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    return starlingFetch<T>(path, searchParams, revalidateSeconds, attempt + 1)
  }

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

// Note the path is singular `account`, unlike the plural `accounts/{uid}/balance`
// above — Starling's own API is inconsistent about this between endpoint
// families. Requires the `space:read` scope.
export async function getSpaces(accountUid: string): Promise<StarlingSpace[]> {
  const data = await starlingFetch<{
    savingsGoals?: { savingsGoalUid: string; name: string; totalSaved: StarlingAmount; state?: string }[]
    spendingSpaces?: { spaceUid?: string; uid?: string; name: string; balance?: StarlingAmount; amount?: StarlingAmount; state?: string }[]
  }>(`/api/v2/account/${accountUid}/spaces`)

  const savingsGoals: StarlingSpace[] = (data.savingsGoals ?? []).map((g) => ({
    spaceUid: g.savingsGoalUid,
    name: g.name,
    spaceType: 'savings_goal',
    amount: g.totalSaved,
    state: g.state ?? null,
  }))

  const spendingSpaces: StarlingSpace[] = (data.spendingSpaces ?? [])
    .filter((s) => (s.balance ?? s.amount) && (s.spaceUid ?? s.uid))
    .map((s) => ({
      spaceUid: (s.spaceUid ?? s.uid) as string,
      name: s.name,
      spaceType: 'spending_space',
      amount: (s.balance ?? s.amount) as StarlingAmount,
      state: s.state ?? null,
    }))

  return [...savingsGoals, ...spendingSpaces]
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
