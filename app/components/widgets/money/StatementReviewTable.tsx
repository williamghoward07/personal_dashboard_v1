'use client'

import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { GlassCardHeader, GlassCardContent } from '@/components/ui/glass-card'

export interface ReviewRow {
  id: string
  included: boolean
  date: string
  amount: number
  type: 'income' | 'outgoing'
  category: string
  description: string
  possibleDuplicate: boolean
}

const inputClass =
  'w-full rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 text-xs text-on-surface outline-none focus:border-secondary-container'

// Controlled: the parent (StatementImportBoard) owns the row array and
// re-renders on every edit, matching this app's form-state convention
// elsewhere rather than this table keeping its own copy.
export default function StatementReviewTable({
  rows,
  onChange,
}: {
  rows: ReviewRow[]
  onChange: (rows: ReviewRow[]) => void
}) {
  const updateRow = (id: string, patch: Partial<ReviewRow>) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const includedCount = rows.filter((r) => r.included).length

  return (
    <ModuleGlassCard accent="blue" className="flex flex-col gap-3">
      <GlassCardHeader>
        <h2 className="font-display text-sm font-semibold text-foreground">
          Review {rows.length} transaction{rows.length === 1 ? '' : 's'} — {includedCount} selected
        </h2>
      </GlassCardHeader>
      <GlassCardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            No transaction-shaped lines were found in this PDF. It may be a scanned image rather than
            text, or use a layout this parser doesn&apos;t recognise.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant">
                  <th className="w-8 py-2" />
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Description</th>
                  <th className="py-2 pr-2">Category</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2 text-right">Amount (£)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={`border-b border-outline-variant/40 ${row.included ? '' : 'opacity-40'}`}>
                    <td className="py-1.5">
                      <input
                        type="checkbox"
                        checked={row.included}
                        onChange={(e) => updateRow(row.id, { included: e.target.checked })}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={`Include ${row.description || 'this row'}`}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => updateRow(row.id, { date: e.target.value })}
                        className={inputClass}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={row.description}
                        onChange={(e) => updateRow(row.id, { description: e.target.value })}
                        className={inputClass}
                      />
                      {row.possibleDuplicate && (
                        <span className="mt-0.5 block text-[10px] font-medium text-academic-orange">
                          Possible duplicate
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={row.category}
                        onChange={(e) => updateRow(row.id, { category: e.target.value })}
                        className={inputClass}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={row.type}
                        onChange={(e) => updateRow(row.id, { type: e.target.value as 'income' | 'outgoing' })}
                        className={inputClass}
                      >
                        <option value="outgoing">Outgoing</option>
                        <option value="income">Income</option>
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0.01}
                        value={row.amount}
                        onChange={(e) => updateRow(row.id, { amount: Number(e.target.value) })}
                        className={`${inputClass} text-right`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCardContent>
    </ModuleGlassCard>
  )
}
