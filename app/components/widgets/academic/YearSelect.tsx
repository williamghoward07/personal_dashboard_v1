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
    <label className="flex w-fit flex-col gap-1 text-xs text-black/50 dark:text-white/50">
      Academic year
      <select
        value={selectedYearId ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm font-medium text-black/80 outline-none focus:border-black/30 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:focus:border-white/30"
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
