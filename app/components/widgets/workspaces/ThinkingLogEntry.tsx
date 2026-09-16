import type { WorkspaceNote } from '@/lib/types'
import { NOTE_KINDS } from '@/lib/workspaces/kinds'
import { logTimestamp } from './shared'

// One dated entry on the log's vertical rail. Read-only by construction —
// workspace_notes is append-only at the database level, so there is
// deliberately no edit or delete affordance anywhere in this component.
export default function ThinkingLogEntry({ note }: { note: WorkspaceNote }) {
  const meta = NOTE_KINDS[note.kind]
  const Icon = meta.Icon

  return (
    <li className="relative pl-6">
      <span
        className={`absolute left-0 top-2 h-2.5 w-2.5 rounded-full ring-4 ring-surface ${meta.dotClass}`}
        aria-hidden
      />

      <div className="rounded-xl border border-outline-variant bg-surface-container-low/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.chipClass}`}
          >
            <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
            {meta.label}
          </span>
          <time dateTime={note.created_at} className="text-[11px] tabular-nums text-on-surface-variant">
            {logTimestamp(note.created_at)}
          </time>
        </div>

        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-on-surface">{note.body}</p>

        {note.footnote && (
          <p className="mt-2 border-t border-outline-variant/40 pt-2 text-[11px] italic text-on-surface-variant/80">
            {note.footnote}
          </p>
        )}
      </div>
    </li>
  )
}
