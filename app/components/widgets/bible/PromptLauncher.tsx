'use client'

import { useState } from 'react'
import { Copy, ExternalLink } from 'lucide-react'
import { buildBiblePrompt } from '@/lib/bible/prompt-template'

const CLAUDE_PROJECT_URL = process.env.NEXT_PUBLIC_BIBLE_CLAUDE_PROJECT_URL

export default function PromptLauncher({
  reference,
  defaultNote,
}: {
  reference: string
  defaultNote?: string
}) {
  const [note, setNote] = useState(defaultNote ?? '')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const prompt = buildBiblePrompt({ reference, note: note.trim() || 'Help me understand this passage.' })
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard permission denied — nothing to fall back to
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-outline-variant pt-3">
      <h4 className="text-xs font-semibold text-on-surface-variant">Ask Claude</h4>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What's confusing or want to dig into?"
        rows={2}
        className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-bible-crimson"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-outline-variant px-2.5 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? 'Copied' : 'Copy prompt'}
        </button>
        {CLAUDE_PROJECT_URL && (
          <a
            href={CLAUDE_PROJECT_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-on-surface-variant hover:text-bible-crimson"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Claude Project
          </a>
        )}
      </div>
    </div>
  )
}
