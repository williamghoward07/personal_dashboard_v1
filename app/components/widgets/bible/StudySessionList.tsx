'use client'

import Link from 'next/link'
import { StatusBadge } from '@/components/ui/status-badge'
import type { BibleStudySession } from '@/lib/bible/types'

// Compact ordered rows for the active study's sessions — fixed
// author-defined order (session_number), each linking to its own detail
// page. No drag-to-reorder: nothing here is meant to be reordered.
export default function StudySessionList({ sessions }: { sessions: BibleStudySession[] }) {
  if (sessions.length === 0) {
    return <p className="text-sm text-on-surface-variant">This study has no sessions yet.</p>
  }

  return (
    <ul className="flex flex-col divide-y divide-outline-variant/40">
      {sessions.map((session) => (
        <li key={session.id}>
          <Link
            href={`/bible/study/sessions/${session.id}`}
            className="flex items-center justify-between gap-2 py-2 text-sm text-on-surface hover:text-bible-crimson"
          >
            <span>
              Session {session.session_number}
              {session.title ? ` — ${session.title}` : ''}
            </span>
            <StatusBadge
              accent={session.completed_at ? 'crimson' : 'neutral'}
              dot={session.completed_at ? 'static' : false}
              size="sm"
              className="shrink-0"
            >
              {session.completed_at ? 'Completed' : 'Not started'}
            </StatusBadge>
          </Link>
        </li>
      ))}
    </ul>
  )
}
