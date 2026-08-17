import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as toolCodegraph from '@deepseek-ai/dsh-tool-codegraph'

describe('dsh-tool-codegraph real-load-path guard', () => {
  it('has no default export and keeps name/inject/Config through unwrapExports', () => {
    expect('default' in toolCodegraph).toBe(false)
    const loader = Object.create(Loader.prototype) as Loader
    const unwrapped = loader.unwrapExports(toolCodegraph) as Record<string, unknown>
    expect(unwrapped).toBe(toolCodegraph)
    expect(unwrapped.name).toBe('tool-codegraph')
    expect(unwrapped.inject).toEqual(['tools', 'systemPrompt'])
    expect(typeof unwrapped.apply).toBe('function')
  })

  it('boots through the unwrapped module without an inject error', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    const loader = Object.create(Loader.prototype) as Loader
    const unwrapped = loader.unwrapExports(toolCodegraph) as Parameters<Context['plugin']>[0]
    const fiber = await ctx.plugin(unwrapped)
    expect(ctx.tools.schemas().map(schema => schema.name)).toContain('codegraph_explore')
    await fiber.dispose()
  })
})
