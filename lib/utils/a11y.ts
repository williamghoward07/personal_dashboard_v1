import type { KeyboardEvent } from 'react'

// Keyboard activation for a non-button element acting as a button/link
// (role="button" / role="link" + tabIndex). Only fires when the element
// itself has focus — a keypress inside a nested input, button or checkbox
// (or inside a portal modal rendered from within it, since React bubbles
// synthetic events through the component tree, not the DOM) is left alone.
// Without that guard, typing a space into a nested rename field activates
// the whole card.
export function onActivateKey(fn: () => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fn()
    }
  }
}
