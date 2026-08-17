import { describe, expect, it } from 'vitest'
import { EXTRA_TOOL_IDS, EXTRA_TOOLS, resolveExtraTools } from '@deepseek-ai/dsh-tool-codegraph'

describe('resolveExtraTools', () => {
  it('accepts the empty list and the full closed set', () => {
    expect(resolveExtraTools([])).toEqual([])
    expect(resolveExtraTools([...EXTRA_TOOL_IDS])).toEqual([...EXTRA_TOOL_IDS])
    expect(Object.keys(EXTRA_TOOLS)).toEqual([...EXTRA_TOOL_IDS])
  })

  it('rejects an unknown id and a duplicate', () => {
    expect(() => resolveExtraTools(['trace'])).toThrow(/unknown extraTools entry "trace"/)
    expect(() => resolveExtraTools(['status', 'status'])).toThrow(/extraTools repeats "status"/)
  })
})
