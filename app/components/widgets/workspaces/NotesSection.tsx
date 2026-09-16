'use client'

import { useMemo, useState } from 'react'
import { Brain, Hash, Send, X } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import type { WorkspaceNote, WorkspaceNoteKind } from '@/lib/types'
import { NOTE_KINDS, NOTE_KIND_ORDER } from '@/lib/workspaces/kinds'
import { extractHashtags, mergeTags, normalizeTag, tagSuggestions } from '@/lib/workspaces/tags'
import type { AddNoteOptions } from '@/lib/workspaces/use-workspace-notes'
import ThinkingLogEntry from './ThinkingLogEntry'
import { CollapseButton } from './SectionChrome'
import { inputClass, microLabelClass, primaryButtonClass, wsAccentStyle } from './shared'

const MAX_SUGGESTIONS = 8

// Notes are owned by WorkspaceDetailBoard so the header meta and the stat
// cards stay in sync with this list — a second useWorkspaceNotes instance
// here would give them separate caches.
export default function NotesSection({
  notes,
  loading,
  error,
  addNote,
  tagPool,
  onCollapse,
}: {
  notes: WorkspaceNote[]
  loading: boolean
  error: string | null
  addNote: (body: string, options?: AddNoteOptions) => Promise<void>
  // Tags used anywhere (all workspaces), for suggestions.
  tagPool: { tags: string[] }[]
  onCollapse: () => void
}) {
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<WorkspaceNoteKind>('note')
  const [footnote, setFootnote] = useState('')
  const [chipTags, setChipTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const inlineTags = useMemo(() => extractHashtags(body), [body])
  const composedTags = useMemo(() => mergeTags(chipTags, inlineTags), [chipTags, inlineTags])

  const suggestions = useMemo(() => {
    const draft = normalizeTag(tagDraft) ?? ''
    return tagSuggestions([...tagPool, ...notes])
      .filter((tag) => !composedTags.includes(tag) && tag.startsWith(draft))
      .slice(0, MAX_SUGGESTIONS)
  }, [tagPool, notes, composedTags, tagDraft])

  const visibleNotes = useMemo(
    () => (activeTag ? notes.filter((n) => n.tags?.includes(activeTag)) : notes),
    [notes, activeTag]
  )

  const addChipTag = (raw: string) => {
    const tag = normalizeTag(raw)
    if (tag && !chipTags.includes(tag)) setChipTags((prev) => [...prev, tag])
    setTagDraft('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    // A half-typed tag still counts.
    const pending = normalizeTag(tagDraft)
    await addNote(trimmed, { kind, footnote, tags: pending ? [...chipTags, pending] : chipTags })
    setBody('')
    setFootnote('')
    setKind('note')
    setChipTags([])
    setTagDraft('')
  }

  return (
    <ModuleGlassCard style={wsAccentStyle} size="sm" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-on-surface">
          <Brain className="h-4 w-4 text-ws-accent" strokeWidth={1.75} />
          Thinking log
          <span className="rounded-full border border-outline-variant px-1.5 py-0.5 text-[11px] tabular-nums text-on-surface-variant">
            {notes.length}
          </span>
        </h2>
        <span className="flex items-center gap-1.5">
          <span
            className="led-dot"
            style={{ '--led-color': 'var(--color-ws-accent)' } as React.CSSProperties}
            aria-hidden
          />
          <span className={microLabelClass}>Stream active</span>
          <CollapseButton label="Thinking log" onClick={onCollapse} />
        </span>
      </div>

      <p className="text-xs leading-relaxed text-on-surface-variant">
        Dated timeline to reconstruct your thinking when resuming after days or weeks away. Not a todo, not a draft —
        entries can never be edited or deleted. Tag entries with #hashtags to find them again.
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
          placeholder="Log an observation, source critique, or train of thought... (#tags work inline)"
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
                aria-pressed={kind === k}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  kind === k ? meta.chipClass : 'border-outline-variant text-on-surface-variant hover:border-outline'
                }`}
              >
                {meta.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 focus-within:border-ws-accent">
            <Hash className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" strokeWidth={1.75} aria-hidden />
            {chipTags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-0.5 rounded-full border border-ws-accent/40 bg-ws-accent/10 py-0.5 pl-1.5 pr-1 font-mono text-[10px] text-ws-accent"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => setChipTags((prev) => prev.filter((t) => t !== tag))}
                  aria-label={`Remove tag ${tag}`}
                  className="hover:opacity-70"
                >
                  <X className="h-3 w-3" strokeWidth={2} />
                </button>
              </span>
            ))}
            {inlineTags
              .filter((tag) => !chipTags.includes(tag))
              .map((tag) => (
                <span
                  key={tag}
                  title="From your text"
                  className="rounded-full border border-dashed border-ws-accent/40 px-1.5 py-0.5 font-mono text-[10px] text-ws-accent/80"
                >
                  {tag}
                </span>
              ))}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addChipTag(tagDraft)
                } else if (e.key === 'Backspace' && !tagDraft && chipTags.length > 0) {
                  setChipTags((prev) => prev.slice(0, -1))
                }
              }}
              placeholder={composedTags.length === 0 ? 'Add tags — e.g. pricing, supplier' : 'Add tag'}
              aria-label="Add a tag"
              className="min-w-24 flex-1 bg-transparent py-0.5 text-xs text-on-surface outline-none placeholder:text-on-surface-variant/60"
            />
          </div>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-on-surface-variant/70">Used before:</span>
              {suggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addChipTag(tag)}
                  className="rounded-full border border-outline-variant px-1.5 py-0.5 font-mono text-[10px] text-on-surface-variant transition-colors hover:border-ws-accent/40 hover:text-ws-accent"
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
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

      {activeTag && (
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          Showing
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className="flex items-center gap-1 rounded-full border border-ws-accent/50 bg-ws-accent/10 px-2 py-0.5 font-mono text-[11px] text-ws-accent"
          >
            #{activeTag}
            <X className="h-3 w-3" strokeWidth={2} aria-label="Clear tag filter" />
          </button>
          <span>
            {visibleNotes.length} of {notes.length}
          </span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading...</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nothing logged yet — record your first observation above.</p>
      ) : (
        <ul className="relative flex max-h-200 flex-col gap-3 overflow-y-auto border-l border-outline-variant/50 pl-0">
          {visibleNotes.map((note) => (
            <ThinkingLogEntry
              key={note.id}
              note={note}
              activeTag={activeTag}
              onTagClick={(tag) => setActiveTag((current) => (current === tag ? null : tag))}
            />
          ))}
        </ul>
      )}
    </ModuleGlassCard>
  )
}
