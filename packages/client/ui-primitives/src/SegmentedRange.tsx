/**
 * Segmented range: a sliding thumb that fully covers the selected option.
 * Transform/width CSS transitions retarget from the current computed geometry,
 * so a click mid-slide continues from that position instead of restarting.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import css from './SegmentedRange.module.css'

/** One selectable option in a {@link SegmentedRange}. */
export interface SegmentedRangeOption<T extends string | number> {
  /** Value written through `onChange` when this option is chosen. */
  value: T
  /** Visible label; the caller localizes. */
  label: string
}

/** Props for {@link SegmentedRange}. */
export interface SegmentedRangeProps<T extends string | number> {
  /** Currently selected value. */
  value: T
  /** Options in visual order. */
  options: readonly SegmentedRangeOption<T>[]
  /**
   * Commit a newly selected value.
   * @param value - the chosen option value.
   */
  onChange: (value: T) => void
  /** Accessible name of the unlabeled option strip. */
  'aria-label': string
  /** Button min-width; default `76px`. */
  minWidth?: string | undefined
}

interface ThumbBox {
  x: number
  w: number
  ready: boolean
}

/**
 * Render a segmented switch whose selected fill is an interruptible sliding thumb.
 * @param props - selected value, options, change handler, accessible name, and optional min-width.
 * @returns the range strip.
 */
export function SegmentedRange<T extends string | number>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  minWidth,
}: SegmentedRangeProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)
  const [thumb, setThumb] = useState<ThumbBox>({ x: 0, w: 0, ready: false })

  const measure = useCallback(() => {
    const selected = selectedRef.current
    if (selected === null) return
    const x = selected.offsetLeft
    const w = selected.offsetWidth
    setThumb((current) => {
      if (current.x === x && current.w === w && current.ready) return current
      return { x, w, ready: true }
    })
  }, [])

  useLayoutEffect(measure, [measure, value, options])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const track = trackRef.current
    /* v8 ignore next -- the track ref is attached before useEffect; the observer dies with the element. */
    if (track === null) return
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => { observer.disconnect() }
  }, [measure])

  return (
    <div
      ref={trackRef}
      className={css.track}
      aria-label={ariaLabel}
      style={{
        ...minWidth === undefined ? {} : { '--segment-min-width': minWidth },
        '--thumb-x': `${thumb.x}px`,
        '--thumb-w': `${thumb.w}px`,
      } as CSSProperties}
    >
      <span
        className={css.thumb}
        aria-hidden="true"
        data-ready={thumb.ready ? 'true' : undefined}
      />
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            ref={selected ? selectedRef : undefined}
            type="button"
            aria-pressed={selected}
            onClick={() => { onChange(option.value) }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
