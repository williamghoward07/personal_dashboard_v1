import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, cleanup } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { launcherHeightForRows, MAX_LAUNCHER_ROWS, LAUNCHER_ROW_STEP } from '@/lib/app-launcher/launcher-layout'
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
      <div ref={gridRef} style={{ gridTemplateColumns: '250px 250px' }}>
        <SortableContext items={[props.id ?? 'money']}>
          <HomeWidgetFrame
            id="money"
            label="Money"
            span={1}
            editing={false}
            gridRef={gridRef}
            gridColumns={2}
            onHide={onHide}
            onSizePreview={onSizePreview}
            onSizeCommit={onSizeCommit}
            {...props}
          >
            {props.children ?? <p>widget body</p>}
          </HomeWidgetFrame>
        </SortableContext>
      </div>
    </DndContext>
  )

  return { ...utils, onHide, onSizePreview, onSizeCommit }
}

describe('HomeWidgetFrame', () => {
  beforeEach(() => {
    vi.stubGlobal('PointerEvent', class extends MouseEvent {})
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

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
    const wrapper = container.firstElementChild?.firstElementChild as HTMLElement
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

  it('changes launcher width and rows in separate steps on a two-column home grid', () => {
    const { getByRole, onSizeCommit } = renderFrame({ id: 'app-launcher', label: 'App Launcher', editing: true })
    fireEvent.click(getByRole('button', { name: 'Wider' }))
    expect(onSizeCommit).toHaveBeenLastCalledWith('app-launcher', 2, undefined)
    fireEvent.keyDown(getByRole('slider'), { key: 'ArrowDown' })
    expect(onSizeCommit).toHaveBeenLastCalledWith('app-launcher', 1, launcherHeightForRows(3))
    cleanup()
  })

  it('limits launcher row controls at the expanded maximum', () => {
    const { getByRole, getByText, onSizeCommit } = renderFrame({
      id: 'app-launcher',
      label: 'App Launcher',
      editing: true,
      span: 4,
      height: launcherHeightForRows(MAX_LAUNCHER_ROWS),
    })
    fireEvent.click(getByRole('button', { name: 'More rows' }))
    expect(onSizeCommit).not.toHaveBeenCalled()
    fireEvent.click(getByRole('button', { name: 'Fewer rows' }))
    expect(onSizeCommit).toHaveBeenCalledWith('app-launcher', 4, launcherHeightForRows(MAX_LAUNCHER_ROWS - 1))
    expect(getByText('widget body').parentElement?.style.minHeight).toBe('')
    cleanup()
  })

  it('snaps a launcher corner drag and commits the last preview on release', () => {
    const { getByRole, onSizeCommit, onSizePreview } = renderFrame({ id: 'app-launcher', editing: true })
    const handle = getByRole('slider')
    handle.setPointerCapture = vi.fn()
    handle.hasPointerCapture = () => false

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(handle, { clientX: 100, clientY: 130 })
    expect(onSizePreview).not.toHaveBeenCalled()
    fireEvent.pointerMove(handle, { clientX: 240, clientY: 100 + LAUNCHER_ROW_STEP })
    expect(onSizePreview).toHaveBeenLastCalledWith('app-launcher', 2, launcherHeightForRows(3))
    fireEvent.pointerMove(handle, { clientX: 240, clientY: 100 + 2 * LAUNCHER_ROW_STEP })
    expect(onSizePreview).toHaveBeenLastCalledWith('app-launcher', 2, launcherHeightForRows(4))
    fireEvent.pointerUp(handle)
    expect(onSizeCommit).toHaveBeenCalledWith('app-launcher', 2, launcherHeightForRows(4))
  })

  it('offers touch resize controls for regular widgets without changing a saved desktop width on mobile', () => {
    const { getByRole, onSizeCommit } = renderFrame({ editing: true, span: 3, gridColumns: 1 })
    expect((getByRole('button', { name: 'Money: Wider' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(getByRole('button', { name: 'Money: Taller' }))
    expect(onSizeCommit).toHaveBeenCalledWith('money', 3, 320)
  })

  it('commits the final regular-widget drag preview without waiting for a parent render', () => {
    const { getByRole, onSizeCommit, onSizePreview } = renderFrame({ editing: true, height: 240 })
    const handle = getByRole('slider')
    handle.setPointerCapture = vi.fn()
    handle.hasPointerCapture = () => false
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(handle, { clientX: 350, clientY: 180 })
    expect(onSizePreview).toHaveBeenLastCalledWith('money', 2, 320)
    fireEvent.pointerUp(handle)
    expect(onSizeCommit).toHaveBeenCalledWith('money', 2, 320)
  })

  it('cancels a resize without persisting its preview', () => {
    const { getByRole, onSizeCommit, onSizePreview } = renderFrame({ editing: true, height: 240 })
    const handle = getByRole('slider')
    handle.setPointerCapture = vi.fn()
    handle.hasPointerCapture = () => false
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(handle, { clientX: 350, clientY: 180 })
    fireEvent.pointerCancel(handle)
    expect(onSizeCommit).not.toHaveBeenCalled()
    expect(onSizePreview).toHaveBeenLastCalledWith('money', 1, 240)
  })

})
