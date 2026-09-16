'use client'

import { useState } from 'react'
import type { WorkspaceLink, WorkspaceLinkKind } from '@/lib/types'
import { SOURCE_KINDS, SOURCE_KIND_ORDER } from '@/lib/workspaces/kinds'
import type { WorkspaceLinkPatch } from '@/lib/workspaces/use-workspace-links'
import { ghostButtonClass, inputClass, labelClass, primaryButtonClass } from './shared'

// Inline (never modal) editor for the metadata the card displays: title,
// type, citation, DOI and the free-text size/length label.
export default function SourceDetailsEditor({
  link,
  onSave,
  onClose,
}: {
  link: WorkspaceLink
  onSave: (patch: WorkspaceLinkPatch) => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState(link.title)
  const [kind, setKind] = useState<WorkspaceLinkKind>(link.kind)
  const [citation, setCitation] = useState(link.citation ?? '')
  const [doi, setDoi] = useState(link.doi ?? '')
  const [metaLabel, setMetaLabel] = useState(link.meta_label ?? '')

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        await onSave({
          title: title.trim() || link.title,
          kind,
          citation: citation.trim() || null,
          doi: doi.trim() || null,
          meta_label: metaLabel.trim() || null,
        })
        onClose()
      }}
      className="mt-2 flex flex-col gap-2 rounded-lg border border-outline-variant/60 bg-surface-container-lowest/60 p-2.5"
    >
      <label className={labelClass}>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </label>

      <div className={labelClass}>
        Type
        <div className="flex flex-wrap gap-1.5">
          {SOURCE_KIND_ORDER.map((k) => {
            const meta = SOURCE_KINDS[k]
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  kind === k ? meta.chipClass : 'border-outline-variant text-on-surface-variant hover:border-outline'
                }`}
              >
                {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      <label className={labelClass}>
        Citation
        <input
          value={citation}
          onChange={(e) => setCitation(e.target.value)}
          placeholder="Author, A. (2024). Title. Journal."
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        DOI
        <input
          value={doi}
          onChange={(e) => setDoi(e.target.value)}
          placeholder="10.1038/s41561-024-..."
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Size / length
        <input
          value={metaLabel}
          onChange={(e) => setMetaLabel(e.target.value)}
          placeholder="4.2 MB · 3,410 words"
          className={inputClass}
        />
      </label>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostButtonClass}>
          Cancel
        </button>
        <button type="submit" className={primaryButtonClass}>
          Save
        </button>
      </div>
    </form>
  )
}
