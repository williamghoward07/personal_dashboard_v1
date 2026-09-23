'use client'

import { useState } from 'react'
import { Check, ExternalLink, X } from 'lucide-react'
import { DataTableAvatar, DataTableCell, DataTableRow, DataTableRowActions } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
    <Input
      variant="ghost"
      size="sm"
      accent="amber"
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
      className={`px-1 ${className}`}
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
    <DataTableRow selected={selected}>
      <DataTableCell>
        <span className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select @${follow.handle}`}
            className="h-3.5 w-3.5 shrink-0 accent-people-amber"
          />
          <DataTableAvatar name={follow.display_name || follow.handle} accent="amber" />
          <span className="flex min-w-0 flex-col">
            <a
              href={`https://www.instagram.com/${follow.handle}/`}
              target="_blank"
              rel="noreferrer noopener"
              className="truncate font-mono text-sm text-on-surface hover:text-people-amber"
            >
              @{follow.handle}
            </a>
            <span className="text-xs text-on-surface-variant">{formatDate(follow.followed_at)}</span>
          </span>
        </span>
      </DataTableCell>

      <DataTableCell>
        <span className={follow.display_name ? 'text-on-surface' : 'text-on-surface-variant/60'}>
          {follow.display_name || 'No display name'}
        </span>
        {!follow.person_id && suggestion && (
          <div className="mt-1 flex items-center gap-2 text-xs text-on-surface-variant">
            <span>
              Link to <span className="text-people-amber">{suggestion.person.full_name}</span>?{' '}
              {Math.round(suggestion.score * 100)}%
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
      </DataTableCell>

      <DataTableCell>
        <InlineTextField
          value={follow.category ?? ''}
          placeholder="+ category"
          onCommit={(next) => onCategoryChange(next.trim() || null)}
          className="w-28"
          listId={categoryListId}
        />
      </DataTableCell>

      <DataTableCell>
        <InlineTextField
          value={follow.note ?? ''}
          placeholder="+ note"
          onCommit={(next) => onNoteChange(next.trim() || null)}
          className="min-w-32"
        />
      </DataTableCell>

      <DataTableCell>
        <InstagramPersonPicker
          handle={follow.handle}
          people={people}
          linkedPerson={linkedPerson}
          onLink={onLink}
          onUnlink={onUnlink}
        />
      </DataTableCell>

      <DataTableCell align="right">
        <DataTableRowActions>
          <Button variant="icon" size="icon-sm" aria-label={`Open @${follow.handle} on Instagram`} asChild>
            <a href={`https://www.instagram.com/${follow.handle}/`} target="_blank" rel="noreferrer noopener">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </DataTableRowActions>
      </DataTableCell>
    </DataTableRow>
  )
}
