'use client'

import type { Year } from '@/lib/types'

export default function YearSelect({
  years,
  selectedYearId,
  onChange,
}: {
  years: Year[]
  selectedYearId: string | null
  onChange: (id: string) => void
}) {
  return (
    <label className="flex w-fit flex-col gap-1 text-xs text-on-surface-variant">
      Academic year
      <select
        value={selectedYearId ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm font-medium text-on-surface outline-none focus:border-academic-orange"
      >
        {years.map((y) => (
          <option key={y.id} value={y.id}>
            {y.name}
          </option>
        ))}
      </select>
    </label>
  )
}
