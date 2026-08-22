'use client'

import { useState, type FormEvent } from 'react'
import { ActiveStudyExistsError, importStudy } from '@/lib/bible/studies'

// Paste-JSON import — the only way a study enters the system (no
// step-by-step builder UI). See import_bible_study() in
// 20260822000100_bible_functions.sql for the payload shape this validates
// and applies atomically server-side.
export default function StudyImportForm({ onImported }: { onImported: () => void }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      setError("That's not valid JSON — check for a missing bracket or comma.")
      return
    }

    setLoading(true)
    setError(null)
    try {
      await importStudy(parsed as Parameters<typeof importStudy>[0])
      setText('')
      onImported()
    } catch (err) {
      if (err instanceof ActiveStudyExistsError) setError(err.message)
      else setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <p className="text-sm text-on-surface-variant">
        No active study. Paste a study&apos;s JSON below to start one — sessions and their questions import in one go.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"title": "...", "sessions": [...]}'
        rows={6}
        className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-2 font-mono text-xs text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-bible-crimson"
      />
      <button
        type="submit"
        disabled={loading || !text.trim()}
        className="w-fit rounded-lg border border-outline-variant px-3 py-1.5 text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-40"
      >
        {loading ? 'Importing…' : 'Import study'}
      </button>
      {error && <p className="text-xs text-error">{error}</p>}
    </form>
  )
}
