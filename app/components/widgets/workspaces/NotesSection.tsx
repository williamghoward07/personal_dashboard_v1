'use client'

import { useState } from 'react'
import { Brain, Send } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import type { WorkspaceNote, WorkspaceNoteKind } from '@/lib/types'
import { NOTE_KINDS, NOTE_KIND_ORDER } from '@/lib/workspaces/kinds'
import ThinkingLogEntry from './ThinkingLogEntry'
import { inputClass, microLabelClass, primaryButtonClass } from './shared'

// Notes are owned by WorkspaceDetailBoard so the header meta and the stat
// cards stay in sync with this list — a second useWorkspaceNotes instance
// here would give them separate caches.
export default function NotesSection({
  notes,
  loading,
  error,
  addNote,
}: {
  notes: WorkspaceNote[]
  loading: boolean
  error: string | null
  addNote: (body: string, kind?: WorkspaceNoteKind, footnote?: string | null) => Promise<void>
}) {
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<WorkspaceNoteKind>('note')
  const [footnote, setFootnote] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    await addNote(trimmed, kind, footnote)
    setBody('')
    setFootnote('')
    setKind('note')
  }

  return (
    <ModuleGlassCard accent="teal" size="sm" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-on-surface">
          <Brain className="h-4 w-4 text-workspace-teal" strokeWidth={1.75} />
          Thinking log
          <span className="rounded-full border border-outline-variant px-1.5 py-0.5 text-[11px] tabular-nums text-on-surface-variant">
            {notes.length}
          </span>
        </h2>
        <span className="flex items-center gap-1.5">
          <span
            className="led-dot"
            style={{ '--led-color': 'var(--color-workspace-teal)' } as React.CSSProperties}
            aria-hidden
          />
          <span className={microLabelClass}>Stream active</span>
        </span>
      </div>

      <p className="text-xs leading-relaxed text-on-surface-variant">
        Dated timeline to reconstruct your thinking when resuming after days or weeks away. Not a todo, not a draft —
        entries can never be edited or deleted.
      </p>

      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Log an observation, source critique, or train of thought..."
          className={`${inputClass} resize-y`}
        />

        <div className="flex flex-wrap gap-1.5">
          {NOTE_KIND_ORDER.map((k) => {
            const meta = NOTE_KINDS[k]
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  kind === k ? meta.chipClass : 'border-outline-variant text-on-surface-variant hover:border-outline'
                }`}
              >
                #{meta.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={footnote}
            onChange={(e) => setFootnote(e.target.value)}
            placeholder="Optional footnote — e.g. Pinned to: Section 2"
            className={`${inputClass} flex-1`}
          />
          <button type="submit" disabled={!body.trim()} className={primaryButtonClass}>
            <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
            Record
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading...</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nothing logged yet — record your first observation above.</p>
      ) : (
        <ul className="relative flex max-h-200 flex-col gap-3 overflow-y-auto border-l border-outline-variant/50 pl-0">
          {notes.map((note) => (
            <ThinkingLogEntry key={note.id} note={note} />
          ))}
        </ul>
      )}
    </ModuleGlassCard>
  )
}
