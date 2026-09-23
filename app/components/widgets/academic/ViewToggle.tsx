'use client'

import { FilterTabs } from '@/components/ui/filter-tabs'

export type AcademicView = 'modules' | 'tasks'

const OPTIONS = [
  { value: 'modules' as const, label: 'Modules' },
  { value: 'tasks' as const, label: 'Tasks' },
]

export default function ViewToggle({
  view,
  onChange,
}: {
  view: AcademicView
  onChange: (view: AcademicView) => void
}) {
  return (
    <FilterTabs
      aria-label="Academic view"
      accent="orange"
      size="compact"
      options={OPTIONS}
      value={view}
      onChange={onChange}
    />
  )
}
