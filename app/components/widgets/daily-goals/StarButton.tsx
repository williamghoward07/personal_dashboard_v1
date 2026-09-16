'use client'

import { Star } from 'lucide-react'

// Star toggle for a todo. Starred = "Important" in Microsoft To Do, and
// a starred undated todo stays on the Daily Goals checklist. Unstarred,
// it only shows on row hover/focus (`group` on the row) unless `alwaysShow`.
export default function StarButton({
  starred,
  title,
  onToggle,
  alwaysShow = false,
}: {
  starred: boolean
  title: string
  onToggle: () => void
  alwaysShow?: boolean
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      onKeyDown={(e) => e.stopPropagation()}
      aria-pressed={starred}
      aria-label={starred ? `Unstar ${title}` : `Star ${title}`}
      title={starred ? 'Starred' : 'Star'}
      className={`shrink-0 rounded p-1.5 transition-opacity hover:bg-surface-container-high focus-visible:opacity-100 ${
        starred
          ? 'text-people-amber'
          : `text-on-surface-variant hover:text-people-amber ${alwaysShow ? '' : 'opacity-0 group-hover:opacity-100'}`
      }`}
    >
      <Star className="h-3.5 w-3.5" fill={starred ? 'currentColor' : 'none'} />
    </button>
  )
}
