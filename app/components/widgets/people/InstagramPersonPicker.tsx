'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, UserPlus, X } from 'lucide-react'
import Popover from '../../Popover'
import { normalizeForMatch } from '@/lib/instagram/match'
import type { Person } from '@/lib/types'

export default function InstagramPersonPicker({
  handle,
  people,
  linkedPerson,
  onLink,
  onUnlink,
}: {
  handle: string
  people: Person[]
  linkedPerson: Person | null
  onLink: (personId: string) => void
  onUnlink: () => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = normalizeForMatch(query)
    return people
      .filter((p) => !p.archived)
      .filter((p) => !q || normalizeForMatch(p.full_name).includes(q))
      .slice(0, 50)
  }, [people, query])

  return (
    <Popover
      label={`Link @${handle} to a person`}
      trigger={(props) =>
        linkedPerson ? (
          <button
            type="button"
            {...props}
            className="flex items-center gap-1 rounded-full border border-people-amber/30 bg-people-amber/10 px-2 py-0.5 text-xs text-people-amber"
          >
            {linkedPerson.full_name}
            <ChevronDown className="h-3 w-3" />
          </button>
        ) : (
          <button
            type="button"
            {...props}
            className="flex items-center gap-1 rounded-full border border-outline-variant px-2 py-0.5 text-xs text-on-surface-variant hover:border-people-amber/40 hover:text-people-amber"
          >
            <UserPlus className="h-3 w-3" />
            Link to person…
          </button>
        )
      }
    >
      {(close) => (
        <div className="flex w-64 flex-col gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length > 0) {
                onLink(filtered[0].id)
                close()
              }
            }}
            placeholder="Search people…"
            aria-label="Search people to link"
            className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none focus:border-people-amber"
          />
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {linkedPerson && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onUnlink()
                    close()
                  }}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-error hover:bg-error/10"
                >
                  <X className="h-3.5 w-3.5" />
                  Unlink from {linkedPerson.full_name}
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-2 py-1.5 text-sm text-on-surface-variant">No matching people.</li>
            ) : (
              filtered.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onLink(person.id)
                      close()
                    }}
                    className={`w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-container-high ${
                      linkedPerson?.id === person.id ? 'text-people-amber' : 'text-on-surface'
                    }`}
                  >
                    {person.full_name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </Popover>
  )
}
