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
  const [onenoteSectionId, setOnenoteSectionId] = useState<string | null>(null)
  const [onenoteSectionName, setOnenoteSectionName] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)
  const [sectionOptions, setSectionOptions] = useState<{ id: string; name: string; notebookName: string }[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)

  const openAdd = () => {
    setName('')
    setIsAddOpen(true)
  }

  const openEdit = (m: Module) => {
    setName(m.name)
    setOnenoteSectionId(m.onenote_section_id)
    setOnenoteSectionName(m.onenote_section_name)
    setPickerOpen(false)
    setPickerError(null)
    setSaveError(null)
    setEditingModule(m)
  }

  const openPicker = () => {
    setPickerOpen(true)
    setPickerLoading(true)
    setPickerError(null)
    fetch('/api/microsoft/onenote/sections')
      .then((res) => res.json())
      .then((body) => {
        if (body.error) {
          setPickerError(body.error)
          return
        }
        setSectionOptions(body.sections ?? [])
      })
      .catch(() => setPickerError("Couldn't reach the server."))
      .finally(() => setPickerLoading(false))
  }

  const chooseSection = (section: { id: string; name: string; notebookName: string }) => {
    setOnenoteSectionId(section.id)
    setOnenoteSectionName(section.name)
    setPickerOpen(false)
  }

  const clearSection = () => {
    setOnenoteSectionId(null)
    setOnenoteSectionName(null)
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
    setSaveError(null)
    const { error } = await supabase
      .from('modules')
      .update({
        name: name.trim(),
        onenote_section_id: onenoteSectionId,
        onenote_section_name: onenoteSectionName,
      })
      .eq('id', editingModule.id)
    if (error) {
      setSaveError(error.message)
      return
    }
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
                className="rounded-lg bg-academic-orange px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110"
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
            <div className="flex flex-col gap-1 text-xs text-on-surface-variant">
              <span>OneNote section (in-app browsing)</span>
              {onenoteSectionId ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5">
                  <span className="truncate text-on-surface">{onenoteSectionName}</span>
                  <button
                    type="button"
                    onClick={clearSection}
                    className="shrink-0 text-on-surface-variant hover:text-error"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openPicker}
                  className="w-fit rounded-md border border-dashed border-outline-variant px-2 py-1.5 text-on-surface-variant hover:border-academic-orange hover:text-academic-orange"
                >
                  Choose section
                </button>
              )}
              {pickerOpen && (
                <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-md border border-outline-variant p-1">
                  {pickerLoading ? (
                    <p className="px-2 py-1">Loading sections…</p>
                  ) : pickerError ? (
                    <p className="px-2 py-1 text-error">
                      {pickerError} Connect Microsoft OneNote from the card above the year selector first.
                    </p>
                  ) : sectionOptions.length === 0 ? (
                    <p className="px-2 py-1">No sections found.</p>
                  ) : (
                    sectionOptions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => chooseSection(s)}
                        className="rounded px-2 py-1 text-left text-on-surface hover:bg-surface-container-high"
                      >
                        {s.notebookName} › {s.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {saveError && <p className="text-xs text-error">{saveError}</p>}
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
                className="rounded-lg bg-academic-orange px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110"
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
