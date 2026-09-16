'use client'

import { useEffect, useMemo, useState } from 'react'
import { AtSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { InstagramFollow, Person } from '@/lib/types'
import WidgetCard from '../../WidgetCard'

const MIGRATION_HINT = 'Has supabase/migrations/20260918000000_instagram_follows.sql been run?'

// Imports Instagram's own "Download your information" export
// (following.json) — no Instagram API, no screenshots. Plain markup,
// no design pass yet.
export default function InstagramFollowsCard({ people }: { people: Person[] }) {
  const [follows, setFollows] = useState<InstagramFollow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)

  const refresh = () => {
    supabase
      .from('instagram_follows')
      .select('*')
      .order('followed_at', { ascending: false })
      .then(({ data, error: selectError }) => {
        setError(selectError ? `Couldn't load follows: ${selectError.message}. ${MIGRATION_HINT}` : null)
        setFollows((data ?? []) as InstagramFollow[])
        setLoading(false)
      })
  }

  useEffect(refresh, [])

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

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
        refresh()
      }
    } catch {
      setError('Import failed — check your connection.')
    } finally {
      setImporting(false)
    }
  }

  const link = async (id: string, personId: string) => {
    if (!personId) return
    const { error: linkError } = await supabase.from('instagram_follows').update({ person_id: personId }).eq('id', id)
    if (linkError) setError(`Couldn't link: ${linkError.message}`)
    else refresh()
  }

  const unlink = async (id: string) => {
    const { error: unlinkError } = await supabase.from('instagram_follows').update({ person_id: null }).eq('id', id)
    if (unlinkError) setError(`Couldn't unlink: ${unlinkError.message}`)
    else refresh()
  }

  return (
    <WidgetCard title="Instagram follows" accent="amber" icon={<AtSign className="h-4 w-4" />}>
      <div className="flex flex-col gap-2 text-xs">
        <p>
          Import Instagram&apos;s &quot;Download your information&quot; export: unzip it, find{' '}
          <code>following.json</code>, then paste or upload it below.
        </p>

        <input type="file" accept="application/json" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
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

        {error && <p role="alert">{error}</p>}
        {message && <p>{message}</p>}

        {loading ? (
          <p>Loading…</p>
        ) : follows.length === 0 ? (
          <p>No follows imported yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-outline-variant/40">
            {follows.map((f) => {
              const person = f.person_id ? peopleById.get(f.person_id) : undefined
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5">
                  <a href={`https://www.instagram.com/${f.handle}/`} target="_blank" rel="noreferrer noopener">
                    @{f.handle}
                  </a>
                  {f.display_name && <span>{f.display_name}</span>}
                  <span>followed {new Date(f.followed_at).toLocaleDateString()}</span>
                  {person ? (
                    <span>
                      linked to {person.full_name}{' '}
                      <button type="button" onClick={() => unlink(f.id)}>
                        Unlink
                      </button>
                    </span>
                  ) : (
                    <select defaultValue="" onChange={(e) => void link(f.id, e.target.value)}>
                      <option value="" disabled>
                        Link to…
                      </option>
                      {people
                        .filter((p) => !p.archived)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name}
                          </option>
                        ))}
                    </select>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </WidgetCard>
  )
}
