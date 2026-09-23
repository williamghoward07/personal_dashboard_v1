import type { WorkspaceNote, WorkspaceNoteKind } from '@/lib/types'
import { NOTE_KINDS } from '@/lib/workspaces/kinds'
import type { UiAccent } from '@/lib/theme'
import { TimelineEntry } from '@/components/ui/timeline'
import { logTimestamp } from './shared'

// TimelineEntry's `accent` drives the dot + kind-pill colour through the
// shared ACCENT_* lookup tables in lib/theme.ts (UiAccent), while NOTE_KINDS
// (lib/workspaces/kinds.ts) is its own literal-class map used by the kind
// picker in NotesSection. This local map keeps the two colour choices in
// sync without touching that shared file.
const NOTE_KIND_ACCENT: Record<WorkspaceNoteKind, UiAccent> = {
  realization: 'teal',
  discarded: 'crimson',
  argument: 'amber',
  meeting: 'purple',
  note: 'neutral',
}

// One dated entry on the log's timeline — DESIGN.md §4.9. Read-only by
// construction: workspace_notes is append-only at the database level, so
// there is deliberately no edit or delete affordance anywhere here.
export default function ThinkingLogEntry({
  note,
  activeTag,
  onTagClick,
}: {
  note: WorkspaceNote
  activeTag: string | null
  onTagClick: (tag: string) => void
}) {
  const meta = NOTE_KINDS[note.kind]
  const Icon = meta.Icon

  return (
    <TimelineEntry
      accent={NOTE_KIND_ACCENT[note.kind]}
      kind={meta.label}
      kindIcon={<Icon className="h-3 w-3" strokeWidth={2} aria-hidden />}
      timestamp={logTimestamp(note.created_at)}
      dateTime={note.created_at}
      tags={note.tags ?? []}
      activeTag={activeTag}
      onTagClick={onTagClick}
      footnote={note.footnote}
    >
      {note.body}
    </TimelineEntry>
  )
}
