'use client'

import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { GlassCardHeader, GlassCardContent } from '@/components/ui/glass-card'

export interface ActivityReviewRow {
  id: string
  included: boolean
  date: string
  activity_type: string
  duration_minutes: number | null
  distance_km: number | null
  elevation_gain_m: number | null
  external_id: string | null
}

const inputClass =
  'w-full rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 text-xs text-on-surface outline-none focus:border-primary-container'

export default function ActivityImportReviewTable({
  rows,
  onChange,
}: {
  rows: ActivityReviewRow[]
  onChange: (rows: ActivityReviewRow[]) => void
}) {
  const updateRow = (id: string, patch: Partial<ActivityReviewRow>) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const includedCount = rows.filter((r) => r.included).length

  return (
    <ModuleGlassCard accent="mint" className="flex flex-col gap-3">
      <GlassCardHeader>
        <h2 className="font-display text-sm font-semibold text-foreground">
          Review {rows.length} activit{rows.length === 1 ? 'y' : 'ies'} — {includedCount} selected
        </h2>
      </GlassCardHeader>
      <GlassCardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No usable rows found in this CSV.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant">
                  <th className="w-8 py-2" />
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Duration (min)</th>
                  <th className="py-2 pr-2">Distance (km)</th>
                  <th className="py-2 pr-2">Elevation (m)</th>
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
                        aria-label={`Include ${row.activity_type} on ${row.date}`}
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
                        value={row.activity_type}
                        onChange={(e) => updateRow(row.id, { activity_type: e.target.value })}
                        className={inputClass}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        min={0}
                        value={row.duration_minutes ?? ''}
                        onChange={(e) =>
                          updateRow(row.id, { duration_minutes: e.target.value === '' ? null : Number(e.target.value) })
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.distance_km ?? ''}
                        onChange={(e) =>
                          updateRow(row.id, { distance_km: e.target.value === '' ? null : Number(e.target.value) })
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        min={0}
                        value={row.elevation_gain_m ?? ''}
                        onChange={(e) =>
                          updateRow(row.id, { elevation_gain_m: e.target.value === '' ? null : Number(e.target.value) })
                        }
                        className={inputClass}
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
