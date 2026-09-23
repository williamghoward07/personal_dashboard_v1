import { Search } from 'lucide-react'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { Input } from '@/components/ui/input'
import type { FollowSort, FollowStatusFilter } from '@/lib/instagram/list'

const SORT_OPTIONS: { value: FollowSort; label: string }[] = [
  { value: 'followed_desc', label: 'Follow date (newest first)' },
  { value: 'followed_asc', label: 'Follow date (oldest first)' },
  { value: 'handle_asc', label: 'Handle (A–Z)' },
  { value: 'display_name_asc', label: 'Name (A–Z)' },
]

export default function InstagramFollowsFilters({
  query,
  onQueryChange,
  status,
  onStatusChange,
  counts,
  category,
  onCategoryChange,
  categories,
  sort,
  onSortChange,
}: {
  query: string
  onQueryChange: (value: string) => void
  status: FollowStatusFilter
  onStatusChange: (value: FollowStatusFilter) => void
  counts: Record<FollowStatusFilter, number>
  category: string | null
  onCategoryChange: (value: string | null) => void
  categories: string[]
  sort: FollowSort
  onSortChange: (value: FollowSort) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-outline"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search handle, name, note, category..."
          aria-label="Search Instagram follows"
          size="sm"
          accent="amber"
          className="pl-8"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterTabs
          size="compact"
          accent="amber"
          aria-label="Filter by link status"
          value={status}
          onChange={onStatusChange}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'unlinked', label: 'Unlinked', count: counts.unlinked },
            { value: 'linked', label: 'Linked', count: counts.linked },
          ]}
        />

        <select
          value={category === null ? '__any__' : category}
          onChange={(e) => onCategoryChange(e.target.value === '__any__' ? null : e.target.value)}
          aria-label="Filter by category"
          className="ml-auto rounded-lg border border-outline-variant bg-surface-container-high px-2 py-1 text-xs text-on-surface outline-none focus:border-people-amber"
        >
          <option value="__any__">Any category</option>
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as FollowSort)}
          aria-label="Sort follows"
          className="rounded-lg border border-outline-variant bg-surface-container-high px-2 py-1 text-xs text-on-surface outline-none focus:border-people-amber"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
