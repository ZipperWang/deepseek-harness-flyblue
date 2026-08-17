import { describe, expect, it, vi } from 'vitest'
import { loadCodegraphBindings } from '@deepseek-ai/dsh-tool-codegraph'

function fakeRequire(root: unknown, mcp: unknown): NodeJS.Require {
  const fn = ((id: string) => {
    if (id === '@colbymchenry/codegraph') return root
    if (id === '@colbymchenry/codegraph/dist/mcp/index.js') return mcp
    throw new Error(`unexpected require: ${id}`)
  }) as NodeJS.Require
  return fn
}

describe('loadCodegraphBindings', () => {
  it('throws when a required export is missing', () => {
    expect(() => loadCodegraphBindings(fakeRequire({}, {}))).toThrow(/missing CodeGraph, isInitialized, or ToolHandler/)
    expect(() => loadCodegraphBindings(fakeRequire({ isInitialized: () => true }, {}))).toThrow(/missing/)
  })

  it('opens through CodeGraph.open, maps text blocks, and prefers close()', async () => {
    const close = vi.fn()
    const destroy = vi.fn()
    const execute = vi.fn(async () => ({
      content: [
        { type: 'text', text: 'one' },
        { type: 'image' },
        { type: 'text', text: 'two' },
      ],
      isError: false,
    }))
    class ToolHandler {
      execute = execute
    }
    const open = vi.fn(async () => ({ close, destroy }))
    const bindings = loadCodegraphBindings(fakeRequire(
      { CodeGraph: { open }, isInitialized: () => true },
      { ToolHandler },
    ))
    expect(bindings.isInitialized('/repo')).toBe(true)
    const graph = await bindings.open('/repo')
    expect(open).toHaveBeenCalledWith('/repo', { readOnly: true })
    await expect(graph.execute('codegraph_explore', { query: 'x' })).resolves.toEqual({
      text: 'one\ntwo',
      isError: false,
      indexed: true,
    })
    graph.close()
    expect(close).toHaveBeenCalledOnce()
    expect(destroy).not.toHaveBeenCalled()
  })

  it('falls back to default export and destroy() when close is absent', async () => {
    const destroy = vi.fn()
    const execute = vi.fn(async () => ({ isError: true, content: [{ type: 'text', text: 'refused' }] }))
    class ToolHandler {
      execute = execute
    }
    const bindings = loadCodegraphBindings(fakeRequire(
      { default: { open: async () => ({ destroy }) }, isInitialized: () => true },
      { ToolHandler },
    ))
    const graph = await bindings.open('/repo')
    await expect(graph.execute('codegraph_node', {})).resolves.toEqual({
      text: 'refused',
      isError: true,
      indexed: false,
    })
    const empty = loadCodegraphBindings(fakeRequire(
      { default: { open: async () => ({ destroy }) }, isInitialized: () => true },
      { ToolHandler: class {
        execute = async () => ({})
      } },
    ))
    await expect((await empty.open('/repo')).execute('codegraph_status', {})).resolves.toEqual({
      text: '',
      isError: false,
      indexed: true,
    })
    graph.close()
    expect(destroy).toHaveBeenCalledOnce()
  })
})
