'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Module } from '@/lib/types'
import Modal from '../../Modal'
import ConfirmDialog from '../../ConfirmDialog'

export default function ModuleTabs({
  yearId,
  modules,
  selectedModuleId,
  onSelect,
  onChange,
}: {
  yearId: string
  modules: Module[]
  selectedModuleId: string | null
  onSelect: (id: string) => void
  onChange: () => void
}) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [deletingModule, setDeletingModule] = useState<Module | null>(null)
  const [name, setName] = useState('')

  const openAdd = () => {
    setName('')
    setIsAddOpen(true)
  }

  const openEdit = (m: Module) => {
    setName(m.name)
    setEditingModule(m)
  }

  const saveNew = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await supabase.from('modules').insert({ year_id: yearId, name: name.trim() })
    setIsAddOpen(false)
    onChange()
  }

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingModule || !name.trim()) return
    await supabase
      .from('modules')
      .update({ name: name.trim() })
      .eq('id', editingModule.id)
    setEditingModule(null)
    onChange()
  }

  const confirmDelete = async () => {
    if (!deletingModule) return
    await supabase.from('modules').delete().eq('id', deletingModule.id)
    if (selectedModuleId === deletingModule.id) onSelect('')
    setDeletingModule(null)
    onChange()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {modules.map((m) => (
        <div
          key={m.id}
          className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm ${
            selectedModuleId === m.id
              ? 'border-black/30 bg-black/5 text-black dark:border-white/30 dark:bg-white/10 dark:text-white'
              : 'border-black/10 text-black/60 hover:border-black/20 dark:border-white/10 dark:text-white/60 dark:hover:border-white/20'
          }`}
        >
          <button type="button" onClick={() => onSelect(m.id)} className="cursor-pointer">
            {m.name}
          </button>
          <button
            type="button"
            onClick={() => openEdit(m)}
            aria-label={`Edit ${m.name}`}
            className="rounded p-0.5 text-black/30 hover:text-black/70 dark:text-white/30 dark:hover:text-white/70"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setDeletingModule(m)}
            aria-label={`Delete ${m.name}`}
            className="rounded p-0.5 text-black/30 hover:text-red-600 dark:text-white/30 dark:hover:text-red-400"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={openAdd}
        aria-label="Add module"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-black/20 text-black/50 hover:border-black/40 hover:text-black dark:border-white/20 dark:text-white/50 dark:hover:border-white/40 dark:hover:text-white"
      >
        <Plus className="h-4 w-4" />
      </button>

      {isAddOpen && (
        <Modal onClose={() => setIsAddOpen(false)}>
          <form onSubmit={saveNew} className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-black/80 dark:text-white/80">
              New module
            </h2>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Coasts"
              className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-black/80 px-3 py-1.5 text-sm text-white dark:bg-white/80 dark:text-black"
              >
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingModule && (
        <Modal onClose={() => setEditingModule(null)}>
          <form onSubmit={saveEdit} className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-black/80 dark:text-white/80">
              Edit module
            </h2>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingModule(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-black/80 px-3 py-1.5 text-sm text-white dark:bg-white/80 dark:text-black"
              >
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={deletingModule !== null}
        message={`Delete "${deletingModule?.name}"? This can't be undone.`}
        onCancel={() => setDeletingModule(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
