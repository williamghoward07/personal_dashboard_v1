'use client'

import { useState } from 'react'

// The file/paste/import UI for Instagram's "Download your information"
// export, extracted out of the main card so that file stays focused on
// browsing/editing already-imported follows. Collapsed by default behind
// <details> — importing is occasional, browsing is the everyday task.
export default function InstagramImportPanel({ onImported }: { onImported: () => void }) {
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const onFile = (file: File | null) => {
    if (!file) return
    file.text().then(setText)
  }

  const runImport = async () => {
    if (!text.trim()) return
    setImporting(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/instagram/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: text }),
      })
      const result = (await res.json()) as { added?: number; error?: string }
      if (!res.ok) {
        setError(result.error ?? 'Import failed.')
      } else {
        setMessage(`Added ${result.added ?? 0} new follow${result.added === 1 ? '' : 's'}.`)
        setText('')
        onImported()
      }
    } catch {
      setError('Import failed — check your connection.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <details className="rounded-md border border-outline-variant/60 px-2 py-1.5 text-xs">
      <summary className="cursor-pointer select-none text-on-surface-variant hover:text-people-amber">
        Import following.json
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <p>
          Instagram&apos;s &quot;Download your information&quot; export: unzip it, find <code>following.json</code>,
          then paste or upload it below.
        </p>
        <input type="file" accept="application/json" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder='{"relationships_following": [...]}'
          className="w-full rounded border border-outline-variant bg-surface-container-low p-2 font-mono text-[11px]"
        />
        <button
          type="button"
          onClick={runImport}
          disabled={importing || !text.trim()}
          className="w-fit rounded border border-outline-variant px-2 py-1 disabled:opacity-40"
        >
          {importing ? 'Importing…' : 'Import'}
        </button>
        {error && (
          <p role="alert" className="text-error">
            {error}
          </p>
        )}
        {message && <p className="text-on-surface-variant">{message}</p>}
      </div>
    </details>
  )
}
