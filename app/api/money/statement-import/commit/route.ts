import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { minorUnitsOf } from '@/lib/money'
import type { Transaction } from '@/lib/types'

function dedupeKey(date: string, minorUnits: number, description: string | null): string {
  return `${date}|${minorUnits}|${(description ?? '').trim().toLowerCase()}`
}

interface CommitRow {
  date: string
  amount: number
  type: 'income' | 'outgoing'
  category: string
  description: string | null
}

// Bulk-inserts already-reviewed rows. user_id is always re-derived from
// the session (never trusted from the client) — matches every other
// write route in this app. Uses the normal session-scoped client, not
// the admin one: this is the user writing their own data under RLS, the
// same as manual transaction entry, just batched.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = (await request.json()) as { accountId?: string; originalFilename?: string; rows?: CommitRow[] }
  const { accountId, originalFilename, rows } = body

  if (!accountId || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  // PDF-imported rows only ever attach to a manual account — a
  // Starling-synced account's transactions only ever come from sync, and
  // RLS alone wouldn't catch "this id belongs to the user but is the
  // wrong kind of account."
  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', accountId)
    .eq('source', 'manual')
    .maybeSingle()

  if (!account) {
    return NextResponse.json({ error: 'account_not_found' }, { status: 404 })
  }

  // Skip rows that exactly match a transaction already on this account
  // (date + amount + description) — protects against re-importing an
  // overlapping statement (e.g. two monthly PDFs sharing a few days at
  // the boundary) without blocking the rest of an otherwise-new batch.
  const dates = rows.map((r) => r.date)
  const minDate = dates.reduce((min, d) => (d < min ? d : min))
  const maxDate = dates.reduce((max, d) => (d > max ? d : max))

  const { data: existingRows } = await supabase
    .from('transactions')
    .select('*')
    .eq('account_id', accountId)
    .gte('date', minDate)
    .lte('date', maxDate)

  const existingKeys = new Set(
    ((existingRows ?? []) as Transaction[]).map((t) => dedupeKey(t.date, minorUnitsOf(t), t.description))
  )

  const toInsert = rows.filter(
    (row) => !existingKeys.has(dedupeKey(row.date, Math.round(row.amount * 100), row.description))
  )
  const skippedDuplicates = rows.length - toInsert.length

  const insertRows = toInsert.map((row) => ({
    user_id: user.id,
    account_id: accountId,
    source: 'manual',
    date: row.date,
    amount: row.amount,
    type: row.type,
    // Coalesced, not passed through raw — a bulk insert where some rows
    // have this key and others don't (e.g. one row's category left
    // undefined) is rejected by PostgREST for inconsistent object keys,
    // which is exactly what surfaced as "Failed to save transactions".
    category: row.category || 'Other',
    description: row.description,
    raw: { imported_via: 'pdf_statement', original_filename: originalFilename ?? null },
  }))

  if (insertRows.length > 0) {
    const { error } = await supabase.from('transactions').insert(insertRows)

    if (error) {
      console.error('Statement import commit failed:', error)
      return NextResponse.json({ error: 'commit_failed' }, { status: 502 })
    }
  }

  return NextResponse.json({ committed: insertRows.length, skippedDuplicates })
}
