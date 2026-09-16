'use client'

import { useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import { Brain, Send, Square } from 'lucide-react'
import { brainDumpStore as store } from '@/lib/braindump/store'
import LoadingGlowBorder from '../../LoadingGlowBorder'
import DraftList from '../../capture/DraftList'

export default function BrainDumpBoard() {
  const { text, loading, error } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void store.submit(text)
  }

  return (
    <div className="flex flex-col gap-4 sm:col-span-2 xl:col-span-4">
      <LoadingGlowBorder loading={loading} className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
        <div className="mb-3 flex items-center gap-2">
          <Brain className="h-4 w-4 text-habit-purple" />
          <h2 className="font-display text-sm font-semibold text-on-surface">Daily brain dump</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => store.setText(e.target.value)}
            rows={5}
            disabled={loading}
            placeholder="Write out whatever's on your mind — todos, deadlines, people you talked to, things you need to remember. It'll be split into separate items below for you to review."
            aria-label="Daily brain dump"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-habit-purple disabled:opacity-60"
          />
          <div className="flex items-center justify-end gap-2">
            {loading ? (
              <button
                type="button"
                onClick={store.stop}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-habit-purple hover:bg-surface-container-high"
              >
                <Square className="h-3.5 w-3.5" />
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!text.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-habit-purple px-3 py-1.5 text-sm font-medium text-surface disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                Extract items
              </button>
            )}
          </div>
        </form>
        {loading && <p className="mt-1 text-xs text-on-surface-variant">Reading that…</p>}
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </LoadingGlowBorder>

      <DraftList store={store} tone="purple" />
    </div>
  )
}
