'use client'

import { useState, type FormEvent } from 'react'
import { BIBLE_BOOKS, bookOrderOf } from '@/lib/bible/books'
import { getOrCreatePassageId } from '@/lib/bible/passages-repo'
import LoadingGlowBorder from '../../LoadingGlowBorder'
import type { BiblePassage } from '@/lib/bible/types'

// Manual lookup: book + chapter + optional verse range → get-or-create the
// passage row and open it in PassagePanelModal. No prior notes yet is a
// perfectly normal, expected result here, not an error state.
export default function PassageLookupForm({ onOpenPassage }: { onOpenPassage: (passage: BiblePassage) => void }) {
  const [book, setBook] = useState(BIBLE_BOOKS[0].name)
  const [chapter, setChapter] = useState('')
  const [verseStart, setVerseStart] = useState('')
  const [verseEnd, setVerseEnd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const chapterNum = parseInt(chapter, 10)
    if (!chapterNum || chapterNum <= 0) {
      setError('Enter a chapter number.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const verseStartNum = verseStart.trim() ? parseInt(verseStart, 10) : null
      const verseEndNum = verseEnd.trim() ? parseInt(verseEnd, 10) : null
      const id = await getOrCreatePassageId({
        book,
        chapter: chapterNum,
        verseStart: verseStartNum,
        verseEnd: verseEndNum,
      })
      onOpenPassage({
        id,
        book,
        book_order: bookOrderOf(book) ?? 0,
        chapter: chapterNum,
        verse_start: verseStartNum,
        verse_end: verseEndNum,
        created_at: new Date().toISOString(),
      })
      setChapter('')
      setVerseStart('')
      setVerseEnd('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoadingGlowBorder loading={loading} className="rounded-lg">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
          Book
          <select
            value={book}
            onChange={(e) => setBook(e.target.value)}
            className="rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none focus:border-bible-crimson"
          >
            {BIBLE_BOOKS.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
          Chapter
          <input
            type="number"
            min={1}
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            className="w-20 rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none focus:border-bible-crimson"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
          Verse start
          <input
            type="number"
            min={1}
            value={verseStart}
            onChange={(e) => setVerseStart(e.target.value)}
            placeholder="optional"
            className="w-24 rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-bible-crimson"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
          Verse end
          <input
            type="number"
            min={1}
            value={verseEnd}
            onChange={(e) => setVerseEnd(e.target.value)}
            placeholder="optional"
            className="w-24 rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-bible-crimson"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-40"
        >
          {loading ? 'Looking up…' : 'Look up'}
        </button>
        {error && <p className="w-full text-xs text-error">{error}</p>}
      </form>
    </LoadingGlowBorder>
  )
}
