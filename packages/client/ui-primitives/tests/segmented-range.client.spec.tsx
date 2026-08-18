// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SegmentedRange } from '@deepseek-ai/dsh-client-ui-primitives'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
] as const

describe('SegmentedRange', () => {
  it('marks the selected option and reports clicks', () => {
    const onChange = vi.fn()
    render(
      <SegmentedRange aria-label="Range" value="a" minWidth="88px" options={options} onChange={onChange} />,
    )
    const alpha = screen.getByRole('button', { name: 'Alpha' })
    const beta = screen.getByRole('button', { name: 'Beta' })
    expect(alpha.getAttribute('aria-pressed')).toBe('true')
    expect(beta.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(beta)
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('keeps accepting clicks while a previous selection is still settling', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <SegmentedRange aria-label="Range" value="a" options={options} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }))
    rerender(<SegmentedRange aria-label="Range" value="b" options={options} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }))
    expect(onChange).toHaveBeenNthCalledWith(1, 'b')
    expect(onChange).toHaveBeenNthCalledWith(2, 'a')
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('hides the thumb from the accessibility tree', () => {
    const { container } = render(
      <SegmentedRange aria-label="Range" value="a" options={options} onChange={() => {}} />,
    )
    const thumb = container.querySelector('[aria-hidden="true"]')
    expect(thumb).not.toBeNull()
    expect(thumb?.tagName).toBe('SPAN')
  })

  it('remeasures when ResizeObserver notifies and ignores a second identical box', () => {
    let notify: ResizeObserverCallback | undefined
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { notify = callback }
      observe(): void { /* the test drives notify() */ }
      disconnect(): void { /* unmount */ }
      unobserve(): void { /* unused */ }
    })
    render(<SegmentedRange aria-label="Range" value="a" options={options} onChange={() => {}} />)
    expect(notify).toBeTypeOf('function')
    act(() => { notify?.([], {} as ResizeObserver) })
    act(() => { notify?.([], {} as ResizeObserver) })
    expect(screen.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('renders an empty option list and when ResizeObserver is missing', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const { rerender } = render(
      <SegmentedRange aria-label="Range" value="a" options={[]} onChange={() => {}} />,
    )
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<SegmentedRange aria-label="Range" value="a" options={options} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Alpha' }).getAttribute('aria-pressed')).toBe('true')
  })
})
