'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Module } from '@/lib/types'
import Modal from '../../Modal'
import ConfirmDialog from '../../ConfirmDialog'

const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none focus:border-academic-orange'

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
              ? 'border-academic-orange/50 bg-academic-orange/10 text-academic-orange'
              : 'border-outline-variant text-on-surface-variant hover:border-outline'
          }`}
        >
          <button type="button" onClick={() => onSelect(m.id)} className="cursor-pointer">
            {m.name}
          </button>
          <button
            type="button"
            onClick={() => openEdit(m)}
            aria-label={`Edit ${m.name}`}
            className="rounded p-0.5 text-on-surface-variant hover:text-on-surface"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setDeletingModule(m)}
            aria-label={`Delete ${m.name}`}
            className="rounded p-0.5 text-on-surface-variant hover:text-error"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={openAdd}
        aria-label="Add module"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-outline-variant text-on-surface-variant hover:border-academic-orange hover:text-academic-orange"
      >
        <Plus className="h-4 w-4" />
      </button>

      {isAddOpen && (
        <Modal onClose={() => setIsAddOpen(false)}>
          <form onSubmit={saveNew} className="flex flex-col gap-4">
            <h2 className="font-display text-sm font-semibold text-on-surface">New module</h2>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Coasts"
              className={inputClass}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-academic-orange px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
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
            <h2 className="font-display text-sm font-semibold text-on-surface">Edit module</h2>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingModule(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-academic-orange px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
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
