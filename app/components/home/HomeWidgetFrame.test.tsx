import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, cleanup } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import HomeWidgetFrame from './HomeWidgetFrame'

// The frame is where drag, resize and show/hide meet, so the things worth
// pinning down are structural: nothing shows outside edit mode, the span
// class is the static one Tailwind can see, and the keyboard path to a
// resize commits exactly once and stays inside 1-4.

function renderFrame(props: Partial<React.ComponentProps<typeof HomeWidgetFrame>> = {}) {
  const gridRef = createRef<HTMLDivElement>()
  const onHide = vi.fn()
  const onSizePreview = vi.fn()
  const onSizeCommit = vi.fn()

  const utils = render(
    <DndContext>
      <SortableContext items={['money']}>
        <HomeWidgetFrame
          id="money"
          label="Money"
          span={1}
          editing={false}
          gridRef={gridRef}
          onHide={onHide}
          onSizePreview={onSizePreview}
          onSizeCommit={onSizeCommit}
          {...props}
        >
          <p>widget body</p>
        </HomeWidgetFrame>
      </SortableContext>
    </DndContext>
  )

  return { ...utils, onHide, onSizePreview, onSizeCommit }
}

describe('HomeWidgetFrame', () => {
  it('shows no handles outside edit mode', () => {
    const { queryByLabelText, getByText } = renderFrame()
    expect(queryByLabelText('Reorder Money')).toBeNull()
    expect(queryByLabelText('Hide Money')).toBeNull()
    expect(queryByLabelText('Money size')).toBeNull()
    expect(getByText('widget body').textContent).toBe('widget body')
    cleanup()
  })

  it('shows the grip, hide and resize handles in edit mode', () => {
    const { getByLabelText } = renderFrame({ editing: true })
    expect(getByLabelText('Reorder Money')).not.toBeNull()
    expect(getByLabelText('Hide Money')).not.toBeNull()
    expect(getByLabelText('Money size').getAttribute('aria-valuenow')).toBe('1')
    cleanup()
  })

  it('applies the static span class for its span', () => {
    const { container } = renderFrame({ span: 3 })
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('xl:col-span-3')
    expect(wrapper.className).toContain('sm:col-span-2')
    cleanup()
  })

  it('hides on request', () => {
    const { getByLabelText, onHide } = renderFrame({ editing: true })
    fireEvent.click(getByLabelText('Hide Money'))
    expect(onHide).toHaveBeenCalledWith('money')
    cleanup()
  })

  it('commits a keyboard resize once, clamped to 1-4', () => {
    const one = renderFrame({ editing: true, span: 1 })
    fireEvent.keyDown(one.getByLabelText('Money size'), { key: 'ArrowRight' })
    expect(one.onSizeCommit).toHaveBeenCalledTimes(1)
    expect(one.onSizeCommit).toHaveBeenCalledWith('money', 2, undefined)
    // No half-committed preview state on the keyboard path.
    expect(one.onSizePreview).not.toHaveBeenCalled()
    // The frame is controlled by `span`, so shrinking below 1 is a no-op —
    // it does not re-commit the span it already has.
    fireEvent.keyDown(one.getByLabelText('Money size'), { key: 'ArrowLeft' })
    expect(one.onSizeCommit).toHaveBeenCalledTimes(1)
    cleanup()

    const two = renderFrame({ editing: true, span: 2 })
    fireEvent.keyDown(two.getByLabelText('Money size'), { key: 'ArrowLeft' })
    expect(two.onSizeCommit).toHaveBeenCalledWith('money', 1, undefined)
    cleanup()

    const four = renderFrame({ editing: true, span: 4 })
    fireEvent.keyDown(four.getByLabelText('Money size'), { key: 'ArrowRight' })
    expect(four.onSizeCommit).not.toHaveBeenCalled()
    cleanup()
  })
})
