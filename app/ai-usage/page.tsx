'use client'

import { useEffect, useState } from 'react'
import { Gauge } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { londonDayBoundsUTC } from '@/lib/google/london-day'
import { DAILY_CALL_CAP } from '@/lib/ai/constants'
import { ProgressRing } from '@/components/ui/progress-ring'
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
  search_act: 'Search actions',
  people_quick_add: 'People quick-add',
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
      <h1 className="font-display text-headline-md text-on-surface">AI Usage</h1>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading...</p>
      ) : error ? (
        <p className="text-sm text-on-surface-variant">Couldn&apos;t load AI usage.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <WidgetCard title="Today" icon={<Gauge className="h-4 w-4" />}>
              <div className="flex flex-col items-center gap-2 py-1">
                <ProgressRing accent="neutral" value={ringPercent} size="md" showValue={false} />
                <span className="font-display text-sm font-semibold text-on-surface">
                  {todayCount}/{DAILY_CALL_CAP} calls
                </span>
              </div>
            </WidgetCard>
            <WidgetCard title={`Last ${ROW_LIMIT} calls`}>
              <span className="font-display text-xl font-semibold text-on-surface">${monthCostUsd.toFixed(4)}</span>
              <p className="mt-1 text-xs text-on-surface-variant">Estimated spend, based on real token counts.</p>
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

          <div className="overflow-x-auto rounded-xl border border-outline-variant">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-surface-container-low text-xs text-on-surface-variant">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Feature</th>
                  <th className="px-3 py-2 font-medium">Tier</th>
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 font-medium">In</th>
                  <th className="px-3 py-2 font-medium">Out</th>
                  <th className="px-3 py-2 font-medium">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-outline-variant/50">
                    <td className="px-3 py-2 text-xs text-on-surface-variant">{formatDateTime(r.created_at)}</td>
                    <td className="px-3 py-2 text-on-surface">{FEATURE_LABEL[r.feature] ?? r.feature}</td>
                    <td className="px-3 py-2 text-on-surface-variant">{r.tier}</td>
                    <td className="px-3 py-2 text-xs text-on-surface-variant">{r.model}</td>
                    <td className="px-3 py-2 tabular-nums text-on-surface-variant">{r.input_tokens}</td>
                    <td className="px-3 py-2 tabular-nums text-on-surface-variant">{r.output_tokens}</td>
                    <td className="px-3 py-2 tabular-nums text-on-surface-variant">${Number(r.est_cost_usd).toFixed(5)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-on-surface-variant">
                      No AI calls yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  )
}
