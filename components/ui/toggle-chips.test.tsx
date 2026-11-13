import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { ToggleChips } from './toggle-chips'

const options = [
  { value: 'a', label: 'Alpha', count: 2 },
  { value: 'b', label: 'Beta' },
]

describe('ToggleChips', () => {
  it('reflects the selection in aria-pressed and shows counts', () => {
    const { getByRole } = render(<ToggleChips options={options} value={['a']} onChange={() => {}} aria-label="Types" />)
    expect(getByRole('button', { name: /Alpha/ }).getAttribute('aria-pressed')).toBe('true')
    expect(getByRole('button', { name: /Beta/ }).getAttribute('aria-pressed')).toBe('false')
    expect(getByRole('button', { name: /Alpha/ }).textContent).toContain('2')
    cleanup()
  })

  it('adds and removes a value on click', () => {
    const onChange = vi.fn()
    const { getByRole } = render(<ToggleChips options={options} value={['a']} onChange={onChange} />)
    fireEvent.click(getByRole('button', { name: /Beta/ }))
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b'])
    fireEvent.click(getByRole('button', { name: /Alpha/ }))
    expect(onChange).toHaveBeenLastCalledWith([])
    cleanup()
  })
})
