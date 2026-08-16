import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const insertRows = rows.map((row) => ({
    user_id: user.id,
    account_id: accountId,
    source: 'manual',
    date: row.date,
    amount: row.amount,
    type: row.type,
    category: row.category,
    description: row.description,
    raw: { imported_via: 'pdf_statement', original_filename: originalFilename ?? null },
  }))

  const { error } = await supabase.from('transactions').insert(insertRows)

  if (error) {
    console.error('Statement import commit failed:', error)
    return NextResponse.json({ error: 'commit_failed' }, { status: 502 })
  }

  return NextResponse.json({ committed: insertRows.length })
}
