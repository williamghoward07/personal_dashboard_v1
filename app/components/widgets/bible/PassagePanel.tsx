'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { formatReference } from '@/lib/bible/passages'
import { getPassageNotes, getChapterNotes, addNote } from '@/lib/bible/notes'
import type { BiblePassage, BiblePassageNote } from '@/lib/bible/types'
import PromptLauncher from './PromptLauncher'

// Built once, used from three places: session detail (inline), the topical
// index (in a modal), and manual passage lookup (in a modal). Header +
// notes (exact match, plus a same-chapter fallback) + the prompt launcher.
export default function PassagePanel({
  passage,
  sessionId = null,
  defaultNote,
}: {
  passage: BiblePassage
  sessionId?: string | null
  defaultNote?: string
}) {
  const [notes, setNotes] = useState<BiblePassageNote[]>([])
  const [chapterNotes, setChapterNotes] = useState<BiblePassageNote[]>([])
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  const refresh = () => {
    setLoading(true)
    Promise.all([getPassageNotes(passage.id), getChapterNotes(passage.book, passage.chapter, passage.id)])
      .then(([own, chapter]) => {
        setNotes(own)
        setChapterNotes(chapter)
      })
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [passage.id, passage.book, passage.chapter])

  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = newNote.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await addNote({ passageId: passage.id, noteText: trimmed, sessionId })
      setNewNote('')
      refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg font-semibold text-on-surface">{formatReference(passage)}</h3>

      <div className="flex flex-col gap-3">
        <h4 className="text-xs font-semibold text-on-surface-variant">Notes</h4>

        {loading ? (
          <p className="text-sm text-on-surface-variant">Loading…</p>
        ) : notes.length === 0 && chapterNotes.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No notes yet on this passage.</p>
        ) : (
          <>
            {notes.length > 0 && (
              <ul className="flex flex-col gap-2">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-lg border border-outline-variant bg-surface-container-low p-2 text-sm text-on-surface"
                  >
                    {note.note_text}
                  </li>
                ))}
              </ul>
            )}
            {chapterNotes.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] text-on-surface-variant">Elsewhere in this chapter</span>
                <ul className="flex flex-col gap-2">
                  {chapterNotes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-2 text-sm text-on-surface-variant"
                    >
                      {note.note_text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <form onSubmit={handleAddNote} className="flex flex-col gap-2">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note…"
            rows={2}
            className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-bible-crimson"
          />
          <button
            type="submit"
            disabled={saving || !newNote.trim()}
            className="w-fit rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40"
          >
            Add note
          </button>
        </form>
      </div>

      <PromptLauncher reference={formatReference(passage)} defaultNote={defaultNote} />
    </div>
  )
}
