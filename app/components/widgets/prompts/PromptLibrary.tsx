'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Prompt } from '@/lib/types'
import WidgetCard from '../../WidgetCard'
import ConfirmDialog from '../../ConfirmDialog'
import PromptCard from './PromptCard'
import PromptFormModal from './PromptFormModal'

export default function PromptLibrary() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [deletingPrompt, setDeletingPrompt] = useState<Prompt | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const refresh = () => {
    supabase
      .from('prompts')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setPrompts(data ?? [])
        setLoading(false)
      })
  }

  useEffect(refresh, [])

  const handleCopy = async (p: Prompt) => {
    try {
      await navigator.clipboard.writeText(p.prompt)
      setCopiedId(p.id)
      setTimeout(
        () => setCopiedId((current) => (current === p.id ? null : current)),
        1500,
      )
    } catch {
      // clipboard permission denied — nothing to fall back to
    }
  }

  return (
    <>
      <WidgetCard
        title="Prompt library"
        className="sm:col-span-2 xl:col-span-4"
        action={
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            aria-label="Add prompt"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <Plus className="h-4 w-4" />
          </button>
        }
      >
        {loading ? (
          <p>Loading...</p>
        ) : prompts.length === 0 ? (
          <p>No prompts yet — add one to get started.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {prompts.map((p) => (
              <PromptCard
                key={p.id}
                prompt={p}
                copied={copiedId === p.id}
                onCopy={() => handleCopy(p)}
                onEdit={() => setEditingPrompt(p)}
                onDelete={() => setDeletingPrompt(p)}
              />
            ))}
          </div>
        )}
      </WidgetCard>

      <PromptFormModal
        isOpen={isAddOpen}
        heading="New prompt"
        onClose={() => setIsAddOpen(false)}
        onSave={async (title, promptText) => {
          await supabase.from('prompts').insert({ title, prompt: promptText })
          setIsAddOpen(false)
          refresh()
        }}
      />

      <PromptFormModal
        isOpen={editingPrompt !== null}
        heading="Edit prompt"
        initialTitle={editingPrompt?.title}
        initialPrompt={editingPrompt?.prompt}
        onClose={() => setEditingPrompt(null)}
        onSave={async (title, promptText) => {
          if (!editingPrompt) return
          await supabase
            .from('prompts')
            .update({ title, prompt: promptText })
            .eq('id', editingPrompt.id)
          setEditingPrompt(null)
          refresh()
        }}
      />

      <ConfirmDialog
        isOpen={deletingPrompt !== null}
        message={`Delete "${deletingPrompt?.title}"? This can't be undone.`}
        onCancel={() => setDeletingPrompt(null)}
        onConfirm={async () => {
          if (!deletingPrompt) return
          await supabase.from('prompts').delete().eq('id', deletingPrompt.id)
          setDeletingPrompt(null)
          refresh()
        }}
      />
    </>
  )
}
