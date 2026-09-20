'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { InstagramFollow, Person } from '@/lib/types'
import type { MatchSuggestion } from '@/lib/instagram/match'
import { formatDate } from './shared'
import InstagramPersonPicker from './InstagramPersonPicker'

function InlineTextField({
  value,
  placeholder,
  onCommit,
  className = '',
  listId,
}: {
  value: string
  placeholder: string
  onCommit: (next: string) => void
  className?: string
  listId?: string
}) {
  const [draft, setDraft] = useState(value)

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        e.currentTarget.blur()
      }}
      placeholder={placeholder}
      list={listId}
      className={`w-full min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-on-surface outline-none placeholder:text-on-surface-variant/60 hover:border-outline-variant focus:border-people-amber focus:bg-surface-container-lowest ${className}`}
    />
  )
}

export default function InstagramFollowRow({
  follow,
  people,
  linkedPerson,
  selected,
  onToggleSelect,
  onLink,
  onUnlink,
  onNoteChange,
  onCategoryChange,
  categoryListId,
  suggestion,
  onAcceptSuggestion,
  onDismissSuggestion,
}: {
  follow: InstagramFollow
  people: Person[]
  linkedPerson: Person | null
  selected: boolean
  onToggleSelect: () => void
  onLink: (personId: string) => void
  onUnlink: () => void
  onNoteChange: (note: string | null) => void
  onCategoryChange: (category: string | null) => void
  categoryListId: string
  suggestion: MatchSuggestion | null
  onAcceptSuggestion: () => void
  onDismissSuggestion: () => void
}) {
  return (
    <li className="flex flex-col gap-1 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select @${follow.handle}`}
          className="h-3.5 w-3.5 shrink-0 accent-people-amber"
        />
        <a
          href={`https://www.instagram.com/${follow.handle}/`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-sm font-medium text-on-surface hover:text-people-amber"
        >
          @{follow.handle}
        </a>
        {follow.display_name && <span className="text-xs text-on-surface-variant">{follow.display_name}</span>}
        <span className="text-xs text-on-surface-variant">{formatDate(follow.followed_at)}</span>

        <InlineTextField
          value={follow.category ?? ''}
          placeholder="+ category"
          onCommit={(next) => onCategoryChange(next.trim() || null)}
          className="w-24"
          listId={categoryListId}
        />

        <InlineTextField
          value={follow.note ?? ''}
          placeholder="+ note"
          onCommit={(next) => onNoteChange(next.trim() || null)}
          className="min-w-32 flex-1"
        />

        <InstagramPersonPicker
          handle={follow.handle}
          people={people}
          linkedPerson={linkedPerson}
          onLink={onLink}
          onUnlink={onUnlink}
        />
      </div>

      {!follow.person_id && suggestion && (
        <div className="ml-5 flex items-center gap-2 text-xs text-on-surface-variant">
          <span>
            Link to <span className="text-people-amber">{suggestion.person.full_name}</span>? {Math.round(suggestion.score * 100)}%
          </span>
          <button
            type="button"
            onClick={onAcceptSuggestion}
            aria-label={`Accept suggested link to ${suggestion.person.full_name}`}
            className="rounded p-0.5 text-primary-container hover:bg-primary-container/10"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDismissSuggestion}
            aria-label="Dismiss suggestion"
            className="rounded p-0.5 hover:bg-surface-container-high"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </li>
  )
}
