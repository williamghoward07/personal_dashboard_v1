'use client'

import type { ReactNode } from 'react'

// Wraps an AI input bar with the fixed-border LED-strip glow (see
// `.rainbow-ring` in globals.css) while it's awaiting a response. `relative`
// is always applied since the glow is an absolutely-positioned pseudo-element
// anchored to this wrapper.
export default function LoadingGlowBorder({
  loading,
  className = '',
  children,
}: {
  loading: boolean
  className?: string
  children: ReactNode
}) {
  return <div className={`relative ${className} ${loading ? 'rainbow-ring' : ''}`}>{children}</div>
}
