import { describe, expect, it, vi } from 'vitest'
import type { KeyboardEvent } from 'react'
import { onActivateKey } from './a11y'

function keyEvent(key: string, fromChild = false) {
  const self = {}
  const preventDefault = vi.fn()
  const event = {
    key,
    target: fromChild ? {} : self,
    currentTarget: self,
    preventDefault,
  } as unknown as KeyboardEvent<HTMLElement>
  return { event, preventDefault }
}

describe('onActivateKey', () => {
  it('fires on Enter and Space when the element itself is focused', () => {
    const fn = vi.fn()
    const handler = onActivateKey(fn)
    const enter = keyEvent('Enter')
    const space = keyEvent(' ')
    handler(enter.event)
    handler(space.event)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(enter.preventDefault).toHaveBeenCalled()
    expect(space.preventDefault).toHaveBeenCalled()
  })

  it('ignores keys bubbling up from a nested element (e.g. a rename input)', () => {
    const fn = vi.fn()
    const { event, preventDefault } = keyEvent(' ', true)
    onActivateKey(fn)(event)
    expect(fn).not.toHaveBeenCalled()
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it('ignores other keys', () => {
    const fn = vi.fn()
    onActivateKey(fn)(keyEvent('a').event)
    expect(fn).not.toHaveBeenCalled()
  })
})
