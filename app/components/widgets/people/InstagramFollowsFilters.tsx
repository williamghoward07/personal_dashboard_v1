import { Search } from 'lucide-react'
import type { FollowSort, FollowStatusFilter } from '@/lib/instagram/list'

const STATUS_OPTIONS: { value: FollowStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unlinked', label: 'Unlinked' },
  { value: 'linked', label: 'Linked' },
]

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
      <label className="flex items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 focus-within:border-people-amber">
        <Search className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search handle, name, note, category..."
          aria-label="Search Instagram follows"
          className="w-full bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onStatusChange(opt.value)}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                status === opt.value
                  ? 'border-people-amber/50 bg-people-amber/10 text-people-amber'
                  : 'border-outline-variant text-on-surface-variant hover:border-outline'
              }`}
            >
              {opt.label} ({counts[opt.value]})
            </button>
          ))}
        </div>

        <select
          value={category === null ? '__any__' : category}
          onChange={(e) => onCategoryChange(e.target.value === '__any__' ? null : e.target.value)}
          aria-label="Filter by category"
          className="ml-auto rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 text-xs text-on-surface outline-none focus:border-people-amber"
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
          className="rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 text-xs text-on-surface outline-none focus:border-people-amber"
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
