'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Prompt, PerplexityLink } from '@/lib/types'
import Modal from '../../Modal'

export default function ResearchAttachModal({
  taskId,
  alreadyLinked,
  onClose,
  onAttached,
}: {
  taskId: string
  alreadyLinked: string[]
  onClose: () => void
  onAttached: () => void
}) {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [links, setLinks] = useState<PerplexityLink[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('prompts').select('*').order('created_at', { ascending: true }),
      supabase
        .from('perplexity_links')
        .select('*')
        .order('created_at', { ascending: true }),
    ]).then(([p, l]) => {
      setPrompts(p.data ?? [])
      setLinks(l.data ?? [])
      setLoading(false)
    })
  }, [])

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const attach = async () => {
    const promptRows = Array.from(selected)
      .filter((id) => prompts.some((p) => p.id === id))
      .map((id) => ({ task_id: taskId, prompt_id: id }))
    const linkRows = Array.from(selected)
      .filter((id) => links.some((l) => l.id === id))
      .map((id) => ({ task_id: taskId, perplexity_link_id: id }))

    if (promptRows.length) await supabase.from('task_research_links').insert(promptRows)
    if (linkRows.length) await supabase.from('task_research_links').insert(linkRows)
    onAttached()
  }

  const selectable = (id: string) => !alreadyLinked.includes(id)
  const availablePrompts = prompts.filter((p) => selectable(p.id))
  const availableLinks = links.filter((l) => selectable(l.id))

  return (
    <Modal onClose={onClose}>
      <div className="flex max-h-[70vh] flex-col gap-4">
        <h2 className="text-sm font-semibold text-black/80 dark:text-white/80">
          Attach research
        </h2>

        {loading ? (
          <p className="text-xs text-black/40 dark:text-white/40">Loading...</p>
        ) : (
          <div className="flex flex-col gap-4 overflow-y-auto">
            <div className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold text-black/50 dark:text-white/50">
                Prompts
              </h3>
              {availablePrompts.length === 0 ? (
                <p className="text-xs text-black/40 dark:text-white/40">
                  Nothing available.
                </p>
              ) : (
                availablePrompts.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 text-sm text-black/70 dark:text-white/70"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                    {p.title}
                  </label>
                ))
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold text-black/50 dark:text-white/50">
                Perplexity links
              </h3>
              {availableLinks.length === 0 ? (
                <p className="text-xs text-black/40 dark:text-white/40">
                  Nothing available.
                </p>
              ) : (
                availableLinks.map((l) => (
                  <label
                    key={l.id}
                    className="flex items-center gap-2 text-sm text-black/70 dark:text-white/70"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(l.id)}
                      onChange={() => toggle(l.id)}
                    />
                    {l.title || l.url}
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={attach}
            disabled={selected.size === 0}
            className="rounded-lg bg-black/80 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white/80 dark:text-black"
          >
            Attach
          </button>
        </div>
      </div>
    </Modal>
  )
}
