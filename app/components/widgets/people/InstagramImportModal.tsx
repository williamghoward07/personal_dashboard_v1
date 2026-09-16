'use client'

import { useMemo, useState } from 'react'
import { Copy, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { InstagramAccount } from '@/lib/types'
import { parseInstagramSnapshot, previewSnapshot } from '@/lib/people/instagram-import'
import { buildInstagramPrompt } from '@/lib/people/instagram-prompt'
import Modal from '../../Modal'
import { cancelButtonClass, inputClass, labelClass, saveButtonClass } from './shared'

const CLAUDE_PROJECT_URL = process.env.NEXT_PUBLIC_INSTAGRAM_CLAUDE_PROJECT_URL
const PREVIEW_NAMES = 8

function names(list: { username: string }[]): string {
  const shown = list.slice(0, PREVIEW_NAMES).map((e) => `@${e.username}`)
  return list.length > PREVIEW_NAMES ? `${shown.join(', ')} +${list.length - PREVIEW_NAMES} more` : shown.join(', ')
}

// Screenshots → Claude → paste. The app never touches Instagram itself
// (automated access breaks Instagram's terms and risks the account).
export default function InstagramImportModal({
  isOpen,
  todayKey,
  known,
  firstImport,
  onClose,
  onImported,
}: {
  isOpen: boolean
  todayKey: string
  known: InstagramAccount[]
  firstImport: boolean
  onClose: () => void
  onImported: (message: string) => void
}) {
  const [capturedOn, setCapturedOn] = useState(todayKey)
  // null = follow the "first import" default until the user touches it.
  const [baselineChoice, setBaselineChoice] = useState<boolean | null>(null)
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const baseline = baselineChoice ?? firstImport
  const parsed = useMemo(() => (text.trim() ? parseInstagramSnapshot(text, todayKey) : null), [text, todayKey])
  // The checkbox wins over whatever the pasted JSON says.
  const snapshot = useMemo(() => (parsed?.ok ? { ...parsed.snapshot, baseline } : null), [parsed, baseline])
  const preview = useMemo(() => (snapshot ? previewSnapshot(snapshot, known) : null), [snapshot, known])

  if (!isOpen) return null

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildInstagramPrompt({ capturedOn, baseline }))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError("Couldn't copy — your browser blocked clipboard access.")
    }
  }

  const runImport = async () => {
    if (!snapshot) return
    setSaving(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('import_instagram_snapshot', { p: snapshot })
    setSaving(false)
    if (rpcError) {
      setError(`Import failed: ${rpcError.message}. Has the Instagram log migration been run?`)
      return
    }
    const result = data as { new_accounts: number; new_following: number; new_followers: number }
    setText('')
    setBaselineChoice(null)
    onImported(
      baseline
        ? `Baseline saved — ${result.new_accounts} account${result.new_accounts === 1 ? '' : 's'} recorded. Future imports log what's new.`
        : `Imported — ${result.new_following} new follow${result.new_following === 1 ? '' : 's'}, ${result.new_followers} new follower${result.new_followers === 1 ? '' : 's'}.`
    )
    onClose()
  }

  return (
    <Modal onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-sm font-semibold text-on-surface">Import from Instagram screenshots</h2>
          <p className="text-xs text-on-surface-variant">
            Nothing here connects to Instagram. You take the screenshots, Claude reads them, and you paste its reply.
          </p>
        </div>

        <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-xs text-on-surface-variant">
          <li>
            <span className="text-on-surface">People you followed:</span> Profile → Following → sort icon →{' '}
            <i>Date followed: Latest</i>, then screenshot the top of the list.
          </li>
          <li>
            <span className="text-on-surface">New followers:</span> screenshot the <i>started following you</i> entries in
            Activity (the Followers list isn&apos;t in date order).
          </li>
          <li>
            Copy the instructions below and send them to Claude with the screenshots — or, on the laptop, run{' '}
            <code className="rounded bg-surface-container-high px-1">/instagram-log</code> in Claude Code.
          </li>
          <li>Paste Claude&apos;s reply into the box and import.</li>
        </ol>

        <div className="flex flex-wrap items-end gap-3">
          <label className={labelClass}>
            Screenshots taken on
            <input
              type="date"
              value={capturedOn}
              max={todayKey}
              onChange={(e) => setCapturedOn(e.target.value || todayKey)}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-xs text-on-surface-variant">
            <input
              type="checkbox"
              checked={baseline}
              onChange={(e) => setBaselineChoice(e.target.checked)}
              className="accent-people-amber"
            />
            Baseline (first import — record who&apos;s there, don&apos;t log them as new)
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyPrompt}
            className="flex items-center gap-1.5 rounded-lg border border-outline-variant px-2.5 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? 'Copied' : 'Copy Claude instructions'}
          </button>
          {CLAUDE_PROJECT_URL && (
            <a
              href={CLAUDE_PROJECT_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-on-surface-variant hover:text-people-amber"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Claude Project
            </a>
          )}
        </div>

        <label className={labelClass}>
          Claude&apos;s reply
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder='{"captured_on": "…", "following": [...], "followers": [...]}'
            className={`${inputClass} font-mono text-xs`}
          />
        </label>

        {parsed && !parsed.ok && <p className="text-xs text-error">{parsed.error}</p>}
        {snapshot && preview && (
          <div className="flex flex-col gap-1 rounded-lg border border-outline-variant bg-surface-container-low p-3 text-xs text-on-surface-variant">
            {baseline ? (
              <p className="text-on-surface">
                Baseline: records {snapshot.following.length} you follow and {snapshot.followers.length} following you —
                no &ldquo;new&rdquo; entries.
              </p>
            ) : (
              <>
                <p className="text-on-surface">
                  Adds {preview.newFollowing.length} new follow{preview.newFollowing.length === 1 ? '' : 's'} and{' '}
                  {preview.newFollowers.length} new follower{preview.newFollowers.length === 1 ? '' : 's'}
                  {preview.unchanged > 0 ? ` (${preview.unchanged} already logged)` : ''}.
                </p>
                {preview.newFollowing.length > 0 && <p>You followed: {names(preview.newFollowing)}</p>}
                {preview.newFollowers.length > 0 && <p>Followed you: {names(preview.newFollowers)}</p>}
              </>
            )}
            <p>Nobody is ever marked as unfollowed — screenshots only show part of a list.</p>
          </div>
        )}

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cancelButtonClass}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!snapshot || saving}
            onClick={runImport}
            className={`${saveButtonClass} disabled:opacity-40`}
          >
            {saving ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
