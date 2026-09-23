'use client'

import { useEffect, useState } from 'react'
import { Gauge } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { londonDayBoundsUTC } from '@/lib/google/london-day'
import { DAILY_CALL_CAP } from '@/lib/ai/constants'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from '@/components/ui/data-table'
import { MetadataChip } from '@/components/ui/metadata-chip'
import { StatTile } from '@/components/ui/stat-tile'
import WidgetCard from '../components/WidgetCard'

interface AiUsageRow {
  id: number
  created_at: string
  day: string
  feature: string
  tier: string
  model: string
  input_tokens: number
  output_tokens: number
  est_cost_usd: number
}

const FEATURE_LABEL: Record<string, string> = {
  search: 'Search',
  search_answer: 'Search answers',
  // Retired single-item Act call — kept so older rows still get a label.
  search_act: 'Search actions',
  people_quick_add: 'People quick-add',
  brain_dump: 'Capture / brain dump',
}

const ROW_LIMIT = 100

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short' })
}

export default function AiUsagePage() {
  const [rows, setRows] = useState<AiUsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    supabase
      .from('ai_usage')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(ROW_LIMIT)
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(true)
          setLoading(false)
          return
        }
        setRows((data ?? []) as AiUsageRow[])
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const todayKey = londonDayBoundsUTC().startDateKey
  const todayCount = rows.filter((r) => r.day === todayKey).length
  const monthCostUsd = rows.reduce((sum, r) => sum + Number(r.est_cost_usd), 0)
  const ringPercent = Math.min(100, Math.round((todayCount / DAILY_CALL_CAP) * 100))

  const byFeature = new Map<string, { count: number; cost: number }>()
  for (const r of rows) {
    const entry = byFeature.get(r.feature) ?? { count: 0, cost: 0 }
    entry.count += 1
    entry.cost += Number(r.est_cost_usd)
    byFeature.set(r.feature, entry)
  }

  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      <h1 className="headline-md text-on-surface">AI Usage</h1>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading...</p>
      ) : error ? (
        <p className="text-sm text-on-surface-variant">Couldn&apos;t load AI usage.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <WidgetCard title="Today" icon={<Gauge className="h-4 w-4" />}>
              <StatTile
                label="Today"
                value={todayCount}
                unit={`/ ${DAILY_CALL_CAP} calls`}
                percent={ringPercent}
                accent="neutral"
                icon={<Gauge className="h-5 w-5" strokeWidth={2} />}
                ringTitle="Share of today's call cap used"
                variant="bare"
                className="w-full"
              />
            </WidgetCard>
            <WidgetCard title={`Last ${ROW_LIMIT} calls`}>
              <StatTile
                label="Estimated spend"
                value={`$${monthCostUsd.toFixed(4)}`}
                detail="Based on real token counts"
                accent="neutral"
                variant="bare"
                className="w-full"
              />
            </WidgetCard>
            <WidgetCard title="By feature">
              <div className="flex flex-col gap-1">
                {[...byFeature.entries()]
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([feature, { count, cost }]) => (
                    <div key={feature} className="flex items-center justify-between text-xs">
                      <span className="text-on-surface-variant">{FEATURE_LABEL[feature] ?? feature}</span>
                      <span className="tabular-nums text-on-surface">
                        {count} · ${cost.toFixed(4)}
                      </span>
                    </div>
                  ))}
              </div>
            </WidgetCard>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-low">
            <DataTable containerClassName="overflow-x-auto">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>When</DataTableHeaderCell>
                  <DataTableHeaderCell>Feature</DataTableHeaderCell>
                  <DataTableHeaderCell>Tier</DataTableHeaderCell>
                  <DataTableHeaderCell>Model</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">In</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Out</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Est. cost</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {rows.map((r) => (
                  <DataTableRow key={r.id}>
                    <DataTableCell className="text-xs text-on-surface-variant">
                      {formatDateTime(r.created_at)}
                    </DataTableCell>
                    <DataTableCell>{FEATURE_LABEL[r.feature] ?? r.feature}</DataTableCell>
                    <DataTableCell>
                      <MetadataChip>{r.tier}</MetadataChip>
                    </DataTableCell>
                    <DataTableCell className="text-xs text-on-surface-variant">{r.model}</DataTableCell>
                    <DataTableCell align="right" className="tabular-nums text-on-surface-variant">
                      {r.input_tokens}
                    </DataTableCell>
                    <DataTableCell align="right" className="tabular-nums text-on-surface-variant">
                      {r.output_tokens}
                    </DataTableCell>
                    <DataTableCell align="right" className="tabular-nums text-on-surface-variant">
                      ${Number(r.est_cost_usd).toFixed(5)}
                    </DataTableCell>
                  </DataTableRow>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <DataTableCell colSpan={7} align="center" className="py-6 text-on-surface-variant">
                      No AI calls yet.
                    </DataTableCell>
                  </tr>
                )}
              </DataTableBody>
            </DataTable>
          </div>
        </>
      )}
    </main>
  )
}
