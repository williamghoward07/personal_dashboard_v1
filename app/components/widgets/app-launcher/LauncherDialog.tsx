'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { LauncherLink } from '@/lib/app-launcher/launcher-groups'
import FaviconTile from './FaviconTile'
import { openQuickLink } from './shared'

const OPEN_MS = 320
const CLOSE_MS = 260
const EASE = 'cubic-bezier(0.2, 0.9, 0.25, 1.05)'
const EASE_OUT = 'cubic-bezier(0.4, 0, 0.2, 1)'
const STAGGER_MS = 15
const STAGGER_CAP_MS = 180

/** Shared tile chrome so folder tiles and app tiles sit on one grid. */
export const LAUNCHER_TILE_CLASS =
  'flex min-h-11 min-w-0 flex-col items-center justify-start gap-1 rounded-lg px-0 py-1 hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
export const LAUNCHER_LABEL_CLASS = 'launcher-label block w-full truncate text-center text-xs leading-4 text-on-surface-variant'

export function LauncherApp({ link, onOpen }: { link: LauncherLink; onOpen?: () => void }) {
  return (
    <button type="button" data-launcher-icon onClick={() => { openQuickLink(link); onOpen?.() }} title={link.title} className={LAUNCHER_TILE_CLASS}>
      <FaviconTile title={link.title} url={link.url} faviconPath={link.favicon_path} faviconCustomUrl={link.favicon_custom_url} size="sm" />
      <span className={LAUNCHER_LABEL_CLASS}>{link.title}</span>
    </button>
  )
}

type Animatable = { animate?: (keyframes: Keyframe[], options: KeyframeAnimationOptions) => Animation }

function reducedMotion() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

/** Translate+scale that maps the panel onto the tile it grows out of. */
function originTransform(panel: HTMLElement, from: DOMRect) {
  const to = panel.getBoundingClientRect()
  if (!to.width || !from.width) return null
  const scale = Math.max(0.05, Math.min(1, from.width / to.width))
  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  return `translate(${dx}px, ${dy}px) scale(${scale})`
}

/**
 * Native modal gives focus containment, an inert background and Escape.
 * The panel grows out of `origin` (the tapped tile's rect) and shrinks back
 * into `returnFocusTo` on close; reduced motion falls back to a plain fade.
 */
export default function LauncherDialog({
  title,
  links,
  onClose,
  onClosing,
  origin,
  returnFocusTo,
}: {
  title: string
  links: LauncherLink[]
  onClose: () => void
  /** Fires as the close animation starts, so the caller can undim the launcher. */
  onClosing?: () => void
  origin?: DOMRect | null
  returnFocusTo?: HTMLElement | null
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closingRef = useRef(false)
  const doneRef = useRef(false)
  const callbacks = useRef({ onClose, onClosing, returnFocusTo })
  useEffect(() => { callbacks.current = { onClose, onClosing, returnFocusTo } })

  useEffect(() => {
    const dialog = dialogRef.current
    const panel = panelRef.current as (HTMLDivElement & Animatable) | null
    const backdrop = backdropRef.current as (HTMLDivElement & Animatable) | null
    dialog?.showModal()
    if (panel && backdrop && typeof panel.animate === 'function') {
      const reduced = reducedMotion()
      backdrop.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: reduced ? 120 : OPEN_MS, easing: EASE_OUT })
      const from = origin && !reduced ? originTransform(panel, origin) : null
      if (from) {
        panel.animate([{ transform: from, opacity: 0.4, borderRadius: '28px' }, { transform: 'none', opacity: 1, borderRadius: '16px' }], { duration: OPEN_MS, easing: EASE })
        panel.querySelectorAll<HTMLElement>('[data-launcher-icon]').forEach((icon, index) => {
          icon.animate?.([{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }], {
            duration: 240, delay: 90 + Math.min(index * STAGGER_MS, STAGGER_CAP_MS), easing: EASE, fill: 'backwards',
          })
        })
      } else {
        panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: EASE_OUT })
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (dialog?.open) dialog.close()
    }
  }, [origin])

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    const dialog = dialogRef.current
    if (dialog?.open) dialog.close()
    const target = callbacks.current.returnFocusTo
    if (target?.isConnected) target.focus()
    callbacks.current.onClose()
  }

  function dismiss() {
    if (closingRef.current) return
    closingRef.current = true
    callbacks.current.onClosing?.()
    const panel = panelRef.current as (HTMLDivElement & Animatable) | null
    const backdrop = backdropRef.current as (HTMLDivElement & Animatable) | null
    if (!panel || typeof panel.animate !== 'function') {
      timerRef.current = setTimeout(finish, 0)
      return
    }
    const reduced = reducedMotion()
    const target = callbacks.current.returnFocusTo
    const rect = target?.isConnected ? target.getBoundingClientRect() : origin
    const to = rect && !reduced ? originTransform(panel, rect) : null
    const ms = to ? CLOSE_MS : 120
    backdrop?.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: EASE_OUT, fill: 'forwards' })
    const animation = panel.animate(
      to ? [{ transform: 'none', opacity: 1, borderRadius: '16px' }, { transform: to, opacity: 0, borderRadius: '28px' }] : [{ opacity: 1 }, { opacity: 0 }],
      { duration: ms, easing: to ? EASE_OUT : 'linear', fill: 'forwards' },
    )
    if (animation) animation.onfinish = finish
    // Never leave the modal stuck open if the animation is cancelled or throttled.
    timerRef.current = setTimeout(finish, ms + 120)
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="launcher-dialog-title" onCancel={(event) => { event.preventDefault(); dismiss() }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-hidden border-0 bg-transparent p-0 text-on-surface backdrop:bg-transparent">
      <div ref={backdropRef} aria-hidden="true" onClick={dismiss} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative flex h-full items-center justify-center p-4" onClick={(event) => { if (event.target === event.currentTarget) dismiss() }}>
        <div ref={panelRef} className="max-h-[85dvh] w-[min(92vw,560px)] overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-low p-4 shadow-2xl sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="launcher-dialog-title" className="min-w-0 truncate font-display text-lg font-semibold" title={title}>{title}</h2>
            <button type="button" onClick={dismiss} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-surface-container-high"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {links.map((link) => <LauncherApp key={link.id} link={link} onOpen={dismiss} />)}
          </div>
        </div>
      </div>
    </dialog>
  )
}
