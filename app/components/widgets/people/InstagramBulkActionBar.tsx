'use client'

import { useState } from 'react'
import { Download, Sparkles, Tag, Unlink, X } from 'lucide-react'
import { DataTableBulkBar } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function InstagramBulkActionBar({
  selectedCount,
  autoMatchAvailable,
  onAutoMatch,
  categoryListId,
  onApplyCategory,
  onExport,
  onUnlink,
  onClear,
}: {
  selectedCount: number
  autoMatchAvailable: boolean
  onAutoMatch: () => void
  categoryListId: string
  onApplyCategory: (category: string) => void
  onExport: () => void
  onUnlink: () => void
  onClear: () => void
}) {
  const [category, setCategory] = useState('')

  return (
    <DataTableBulkBar>
      <span className="label-caps text-people-amber">{selectedCount} selected</span>

      <Button variant="outline" size="sm" onClick={onAutoMatch} disabled={!autoMatchAvailable}>
        <Sparkles className="h-3.5 w-3.5" />
        Auto-match
      </Button>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (category.trim()) {
            onApplyCategory(category.trim())
            setCategory('')
          }
        }}
        className="flex items-center gap-1.5"
      >
        <Input
          size="sm"
          accent="amber"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list={categoryListId}
          placeholder="Category…"
          aria-label="Apply category to selected"
          className="w-28"
        />
        <Button type="submit" variant="outline" size="sm" disabled={!category.trim()}>
          <Tag className="h-3.5 w-3.5" />
          Apply
        </Button>
      </form>

      <Button variant="outline" size="sm" onClick={onExport}>
        <Download className="h-3.5 w-3.5" />
        Export
      </Button>

      <Button variant="destructive" size="sm" onClick={onUnlink}>
        <Unlink className="h-3.5 w-3.5" />
        Unlink
      </Button>

      <Button variant="icon" size="icon-sm" onClick={onClear} aria-label="Clear selection" className="ml-auto">
        <X className="h-3.5 w-3.5" />
      </Button>
    </DataTableBulkBar>
  )
}
