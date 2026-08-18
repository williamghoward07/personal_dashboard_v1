'use client'

import { useEffect, useState } from 'react'

// Debounced scroll direction for the mobile collapsing top bar — 'down'
// past a small threshold near the top avoids the bar flickering on tiny
// rubber-band scrolls.
export function useScrollDirection(): 'up' | 'down' {
  const [direction, setDirection] = useState<'up' | 'down'>('up')

  useEffect(() => {
    let lastY = window.scrollY
    let ticking = false

    const handleScroll = () => {
      if (ticking) return
      ticking = true

      requestAnimationFrame(() => {
        const currentY = window.scrollY
        if (currentY < 32) {
          setDirection('up')
        } else if (Math.abs(currentY - lastY) > 4) {
          setDirection(currentY > lastY ? 'down' : 'up')
        }
        lastY = currentY
        ticking = false
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return direction
}
