'use client'

import { useCallback, useEffect, useState } from 'react'

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>
}

// Comet and other modern Chromium/Safari builds support the standard
// Fullscreen API; the webkit-prefixed fallback only matters on older Safari.
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    const el = document.documentElement as FullscreenElement
    setIsSupported(Boolean(el.requestFullscreen || el.webkitRequestFullscreen))

    const handleChange = () => {
      const doc = document as FullscreenDocument
      setIsFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleChange)
    document.addEventListener('webkitfullscreenchange', handleChange)
    handleChange()

    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
      document.removeEventListener('webkitfullscreenchange', handleChange)
    }
  }, [])

  const toggle = useCallback(async () => {
    const doc = document as FullscreenDocument
    const el = document.documentElement as FullscreenElement

    try {
      if (document.fullscreenElement || doc.webkitFullscreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen()
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen()
      } else {
        if (el.requestFullscreen) await el.requestFullscreen()
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
      }
    } catch {
      // Denied, or called outside a user gesture — nothing to recover.
    }
  }, [])

  return { isFullscreen, isSupported, toggle }
}
