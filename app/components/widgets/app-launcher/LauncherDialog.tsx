'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { LauncherLink } from '@/lib/app-launcher/launcher-groups'
import FaviconTile from './FaviconTile'
import { openQuickLink } from './shared'

export function LauncherApp({ link }: { link: LauncherLink }) {
  return (
    <button type="button" onClick={() => openQuickLink(link)} title={link.title}
      className="flex min-h-11 min-w-0 flex-col items-center justify-start gap-1 rounded-lg p-1 hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <FaviconTile title={link.title} url={link.url} faviconPath={link.favicon_path} faviconCustomUrl={link.favicon_custom_url} size="sm" />
      <span className="line-clamp-2 w-full break-words text-center text-xs leading-4 text-on-surface-variant">{link.title}</span>
    </button>
  )
}

/** Native modal provides focus containment, inert background and focus restoration. */
export default function LauncherDialog({ title, links, onClose }: { title: string; links: LauncherLink[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      dialog?.close()
    }
  }, [])

  function dismiss() {
    if (closing) return
    setClosing(true)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    timerRef.current = setTimeout(onClose, reduced ? 0 : 160)
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="launcher-dialog-title" onCancel={(event) => { event.preventDefault(); dismiss() }}
      onClick={(event) => { if (event.target === event.currentTarget) dismiss() }}
      className={`fixed inset-0 m-auto max-h-[85dvh] w-[min(90vw,480px)] overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-low p-5 text-on-surface shadow-2xl transition-[opacity,transform] duration-150 ease-out backdrop:bg-black/50 motion-reduce:transition-none starting:scale-95 starting:opacity-0 ${closing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="launcher-dialog-title" className="min-w-0 break-words font-display text-lg font-semibold">{title}</h2>
        <button type="button" onClick={dismiss} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-surface-container-high"><X className="h-5 w-5" /></button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(72px,1fr))] gap-2">
        {links.map((link) => <LauncherApp key={link.id} link={link} />)}
      </div>
    </dialog>
  )
}
