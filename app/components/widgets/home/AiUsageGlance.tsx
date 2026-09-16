'use client'

import { useEffect, useState } from 'react'
import { Gauge } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { londonDayBoundsUTC } from '@/lib/google/london-day'
import { DAILY_CALL_CAP } from '@/lib/ai/constants'
import { ProgressRing } from '@/components/ui/progress-ring'
import HomeSectionCard from './HomeSectionCard'

interface AiUsageRow {
  day: string
  feature: string
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

function londonMonthStartISO(): string {
  const [year, month] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .split('-')
    .map(Number)
  // Reuses the same UTC-anchoring approach as lib/google/london-day.ts —
  // a plain `new Date(year, month-1, 1)` would use the server's local
  // timezone instead of Europe/London.
  return new Date(Date.UTC(year, month - 1, 1)).toISOString()
}

// Tracking your own AI usage is itself a "stat of my life" (the tiers and
// daily cap are described in CLAUDE.md). Reads ai_usage directly like
// every other glance widget reads its own table; RLS scopes it to the
// signed-in user.
export default function AiUsageGlance() {
  const [rows, setRows] = useState<AiUsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    supabase
      .from('ai_usage')
      .select('day, feature, est_cost_usd')
      .gte('created_at', londonMonthStartISO())
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

  const byFeature = new Map<string, number>()
  for (const r of rows) byFeature.set(r.feature, (byFeature.get(r.feature) ?? 0) + 1)
  const topFeatures = [...byFeature.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

  return (
    <HomeSectionCard href="/ai-usage" title="AI Usage" icon={<Gauge className="h-4 w-4" />} accent="neutral">
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-xs text-on-surface-variant">Couldn&apos;t load AI usage.</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-on-surface-variant">No AI calls yet this month.</p>
      ) : (
        <div className="flex flex-col items-center gap-2 py-1">
          <ProgressRing accent="neutral" value={ringPercent} size="md" showValue={false} />
          <span className="font-display text-sm font-semibold text-on-surface">
            {todayCount}/{DAILY_CALL_CAP} calls today
          </span>
          <span className="text-xs text-on-surface-variant">~${monthCostUsd.toFixed(3)} est. this month</span>
          {topFeatures.length > 0 && (
            <div className="flex w-full flex-col gap-0.5 pt-1">
              {topFeatures.map(([feature, count]) => (
                <div key={feature} className="flex items-center justify-between text-xs text-on-surface-variant">
                  <span className="truncate">{FEATURE_LABEL[feature] ?? feature}</span>
                  <span className="tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </HomeSectionCard>
  )
}
