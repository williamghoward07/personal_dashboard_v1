'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { GlassCardHeader, GlassCardContent } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/lib/money/use-accounts'
import { supabase } from '@/lib/supabase'
import { minorUnitsOf } from '@/lib/money'
import type { Transaction } from '@/lib/types'
import AccountFormModal, { type AccountFormValues } from './AccountFormModal'
import StatementReviewTable, { type ReviewRow } from './StatementReviewTable'

const fieldClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none focus:border-secondary-container'

export default function StatementImportBoard() {
  const router = useRouter()
  const { accounts, createManualAccount } = useAccounts()
  const manualAccounts = accounts.filter((a) => a.source === 'manual')

  const [accountId, setAccountId] = useState('')
  const [newAccountOpen, setNewAccountOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [statementYear, setStatementYear] = useState(String(new Date().getFullYear()))
  const [originalFilename, setOriginalFilename] = useState('')

  const [rows, setRows] = useState<ReviewRow[] | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [commitSummary, setCommitSummary] = useState<string | null>(null)

  const handleParse = async () => {
    if (!accountId || !file) return
    setParsing(true)
    setParseError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('statementYear', statementYear)

      const res = await fetch('/api/money/statement-import/parse', { method: 'POST', body: formData })
      if (!res.ok) {
        setParseError("Couldn't read that PDF — it may be a scanned image rather than text.")
        return
      }

      const data = (await res.json()) as {
        candidates: { date: string; amount: number; type: 'income' | 'outgoing'; category: string; description: string }[]
        originalFilename?: string
      }
      setOriginalFilename(data.originalFilename ?? file.name)

      // Duplicate pre-check: existing transactions on this account across
      // the parsed date range only — not a global check.
      const dates = data.candidates.map((c) => c.date)
      let existing: Transaction[] = []
      if (dates.length > 0) {
        const minDate = dates.reduce((min, d) => (d < min ? d : min))
        const maxDate = dates.reduce((max, d) => (d > max ? d : max))
        const { data: existingRows } = await supabase
          .from('transactions')
          .select('*')
          .eq('account_id', accountId)
          .gte('date', minDate)
          .lte('date', maxDate)
        existing = (existingRows ?? []) as Transaction[]
      }

      setRows(
        data.candidates.map((c, i) => ({
          id: `${i}`,
          included: true,
          date: c.date,
          amount: c.amount,
          type: c.type,
          category: c.category,
          description: c.description,
          possibleDuplicate: existing.some((t) => t.date === c.date && minorUnitsOf(t) === Math.round(c.amount * 100)),
        }))
      )
    } catch {
      setParseError("Couldn't read that PDF — it may be a scanned image rather than text.")
    } finally {
      setParsing(false)
    }
  }

  const handleCommit = async () => {
    if (!rows) return
    const included = rows.filter((r) => r.included)
    if (included.length === 0) return

    setCommitting(true)
    setCommitError(null)
    setCommitSummary(null)

    try {
      const res = await fetch('/api/money/statement-import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          originalFilename,
          rows: included.map((r) => ({
            date: r.date,
            amount: r.amount,
            type: r.type,
            category: r.category,
            description: r.description || null,
          })),
        }),
      })

      if (!res.ok) {
        setCommitError('Failed to save transactions — nothing was committed.')
        return
      }

      const data = (await res.json()) as { committed: number; skippedDuplicates: number }

      if (data.skippedDuplicates > 0) {
        setCommitSummary(
          `Saved ${data.committed}, skipped ${data.skippedDuplicates} already on this account.`
        )
        return
      }

      router.push(`/money/accounts/${accountId}`)
    } catch {
      setCommitError('Failed to save transactions — nothing was committed.')
    } finally {
      setCommitting(false)
    }
  }

  const includedCount = rows?.filter((r) => r.included).length ?? 0

  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      <div>
        <Link
          href="/money"
          className="flex w-fit items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Money
        </Link>
        <h1 className="mt-1 font-display text-headline-lg font-bold text-on-surface">Import bank statement</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Upload a PDF statement, review what was found, then commit the ones you want to keep.
        </p>
      </div>

      <ModuleGlassCard accent="blue" className="flex flex-col gap-4">
        <GlassCardHeader>
          <h2 className="font-display text-sm font-semibold text-foreground">1. Choose an account and PDF</h2>
        </GlassCardHeader>
        <GlassCardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Account
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fieldClass}>
                <option value="" disabled>
                  Select an account…
                </option>
                {manualAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" variant="outline" size="sm" onClick={() => setNewAccountOpen(true)}>
              + New account
            </Button>

            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Starting year (used until the statement itself establishes a year)
              <input
                type="number"
                value={statementYear}
                onChange={(e) => setStatementYear(e.target.value)}
                className={fieldClass}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
            PDF statement
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-on-surface-variant file:mr-3 file:rounded-md file:border file:border-outline-variant file:bg-surface-container-lowest file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-on-surface"
            />
          </label>

          {parseError && <p className="text-xs text-error">{parseError}</p>}

          <div>
            <Button type="button" size="sm" disabled={!accountId || !file || parsing} onClick={handleParse}>
              <Upload className="h-4 w-4" />
              {parsing ? 'Reading PDF…' : 'Parse statement'}
            </Button>
          </div>
        </GlassCardContent>
      </ModuleGlassCard>

      {rows && (
        <>
          <StatementReviewTable rows={rows} onChange={setRows} />

          {commitError && <p className="text-xs text-error">{commitError}</p>}
          {commitSummary && <p className="text-xs text-on-surface-variant">{commitSummary}</p>}

          <div className="flex items-center gap-2">
            {commitSummary ? (
              <Button type="button" onClick={() => router.push(`/money/accounts/${accountId}`)}>
                Continue to account
              </Button>
            ) : (
              <Button type="button" disabled={committing || includedCount === 0} onClick={handleCommit}>
                {committing ? 'Saving…' : `Commit ${includedCount} transaction${includedCount === 1 ? '' : 's'}`}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => setRows(null)}>
              Start over
            </Button>
          </div>
        </>
      )}

      <AccountFormModal
        isOpen={newAccountOpen}
        heading="New account"
        onClose={() => setNewAccountOpen(false)}
        onSave={async (values: AccountFormValues) => {
          const created = await createManualAccount(values)
          setNewAccountOpen(false)
          if (created) setAccountId(created.id)
        }}
      />
    </main>
  )
}
