import { describe, expect, it, vi } from 'vitest'
import { resolve } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { type ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import * as ToolCodegraph from '@deepseek-ai/dsh-tool-codegraph'
import {
  applyWithDriver,
  CODEGRAPH_PROMPT_TEXT,
  codegraphIsConcurrencySafe,
  DEFAULT_CODEGRAPH_TOOL_TIMEOUT_MS,
} from '@deepseek-ai/dsh-tool-codegraph'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import type { CodegraphDriver } from '@deepseek-ai/dsh-tool-codegraph'

const workspace = resolve('/virtual/workspace')
const testToolSignal = new AbortController().signal
let seq = 0

function fakeAgent(cwd: string | undefined): { session: { header: { cwd?: string } } } | undefined {
  return cwd === undefined ? undefined : { session: { header: { cwd } } }
}

async function mount(
  driver: CodegraphDriver,
  config: Required<ToolCodegraph.Config> = {
    extraTools: [],
    isolation: 'in-process',
    timeoutMs: DEFAULT_CODEGRAPH_TOOL_TIMEOUT_MS,
  },
): Promise<{ ctx: Context; call: (name: string, args: unknown, cwd?: string | null) => Promise<ToolExecutionResult> }> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  applyWithDriver(ctx, config, driver)
  const call = (name: string, args: unknown, cwd: string | null = workspace) => ctx.tools.execute({
    signal: testToolSignal,
    callId: `c-${++seq}` as never,
    name,
    arguments: args,
    ...cwd === null ? {} : { agent: fakeAgent(cwd) as never },
  })
  return { ctx, call }
}

function stubDriver(execute: CodegraphDriver['execute'] = async () => ({
  text: 'graph body',
  isError: false,
  indexed: true,
})): CodegraphDriver & { execute: ReturnType<typeof vi.fn> } {
  const fn = vi.fn(execute)
  return { execute: fn, dispose: vi.fn() }
}

describe('tool-codegraph registration', () => {
  it('registers explore, the prompt section, and the default timeout', async () => {
    const { ctx } = await mount(stubDriver())
    expect(ctx.tools.get('codegraph_explore')?.timeoutMs).toBe(DEFAULT_CODEGRAPH_TOOL_TIMEOUT_MS)
    expect(ctx.tools.schemas().map(schema => schema.name)).toEqual(['codegraph_explore'])
    const prompt = await ctx.systemPrompt.assemble()
    expect(prompt.sections.find(section => section.name === 'tool:codegraph')?.text).toBe(CODEGRAPH_PROMPT_TEXT)
  })

  it('honors extraTools and a timeout override', async () => {
    const { ctx } = await mount(stubDriver(), {
      extraTools: ['status', 'search'],
      isolation: 'in-process',
      timeoutMs: 12_000,
    })
    expect(ctx.tools.schemas().map(schema => schema.name).sort()).toEqual([
      'codegraph_explore',
      'codegraph_search',
      'codegraph_status',
    ])
    expect(ctx.tools.get('codegraph_status')?.timeoutMs).toBe(12_000)
  })

  it('rejects a non-positive timeout at registration', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    expect(() => applyWithDriver(ctx, {
      extraTools: [],
      isolation: 'auto',
      timeoutMs: 0,
    }, stubDriver())).toThrow(`tool-codegraph: timeoutMs must be an integer between 1 and ${MAX_TIMER_DELAY_MS}`)
  })

  it('disposes the driver when the plugin fiber is disposed', async () => {
    const driver = stubDriver()
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    applyWithDriver(ctx, {
      extraTools: [],
      isolation: 'in-process',
      timeoutMs: DEFAULT_CODEGRAPH_TOOL_TIMEOUT_MS,
    }, driver)
    await ctx.fiber.dispose()
    expect(driver.dispose).toHaveBeenCalledOnce()
  })
})

describe('codegraph_explore execution', () => {
  it('passes the session cwd and returns the canonical value', async () => {
    const driver = stubDriver()
    const { call } = await mount(driver)
    const result = await call('codegraph_explore', { query: 'AuthService' })
    expect(result.isError).toBe(false)
    expect(result.content).toEqual([{ type: 'text', text: 'graph body' }])
    expect(driver.execute).toHaveBeenCalledWith(
      'codegraph_explore',
      { query: 'AuthService', projectPath: workspace },
      testToolSignal,
    )
  })

  it('forwards maxFiles and a nested projectPath', async () => {
    const driver = stubDriver()
    const { call } = await mount(driver)
    await call('codegraph_explore', { query: 'login', maxFiles: 3, projectPath: 'pkg' })
    expect(driver.execute).toHaveBeenCalledWith(
      'codegraph_explore',
      { query: 'login', maxFiles: 3, projectPath: resolve(workspace, 'pkg') },
      testToolSignal,
    )
  })

  it('fails without a workspace and when projectPath escapes', async () => {
    const { call } = await mount(stubDriver())
    const missing = await call('codegraph_explore', { query: 'x' }, null)
    expect(missing.isError).toBe(true)
    expect(missing.content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('session workspace cwd') })

    const escaped = await call('codegraph_explore', { query: 'x', projectPath: '..' })
    expect(escaped.isError).toBe(true)
    expect(escaped.content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('stay inside') })
  })

  it('keeps an unindexed result successful and throws engine isError', async () => {
    const unindexed = stubDriver(async () => ({ text: 'no index', isError: false, indexed: false }))
    const { call: callUnindexed } = await mount(unindexed)
    const guidance = await callUnindexed('codegraph_explore', { query: 'x' })
    expect(guidance.isError).toBe(false)
    expect(guidance.content).toEqual([{ type: 'text', text: 'no index' }])

    const failing = stubDriver(async () => ({ text: 'refused', isError: true, indexed: false }))
    const { call: callFailing } = await mount(failing)
    const refused = await callFailing('codegraph_explore', { query: 'x' })
    expect(refused.isError).toBe(true)
    expect(refused.content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('refused') })
  })

  it('presents a search card titled by the query', async () => {
    const { ctx } = await mount(stubDriver())
    const explore = ctx.tools.get('codegraph_explore')
    expect(codegraphIsConcurrencySafe()).toBe(true)
    expect(explore?.presentCall?.({ query: 'AuthService' })).toEqual({
      card: 'generic',
      title: 'AuthService',
      kind: 'search',
      rawInput: 'AuthService',
    })
  })
})

describe('extra tool execution', () => {
  it('dispatches status through the same driver', async () => {
    const driver = stubDriver()
    const { call } = await mount(driver, {
      extraTools: ['status'],
      isolation: 'in-process',
      timeoutMs: DEFAULT_CODEGRAPH_TOOL_TIMEOUT_MS,
    })
    const result = await call('codegraph_status', {})
    expect(result.isError).toBe(false)
    expect(driver.execute).toHaveBeenCalledWith(
      'codegraph_status',
      { projectPath: workspace },
      testToolSignal,
    )
    const status = (await mount(stubDriver(), {
      extraTools: ['status'],
      isolation: 'in-process',
      timeoutMs: DEFAULT_CODEGRAPH_TOOL_TIMEOUT_MS,
    })).ctx.tools.get('codegraph_status')
    expect(codegraphIsConcurrencySafe()).toBe(true)
    expect(status?.presentCall?.({})).toMatchObject({ title: 'codegraph_status', kind: 'search' })
  })
})

describe('apply() driver construction', () => {
  it('activates with an explicit in-process isolation without executing the engine', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    const fiber = await ctx.plugin(ToolCodegraph, { isolation: 'in-process' })
    expect(ctx.tools.get('codegraph_explore')).toBeDefined()
    await fiber.dispose()
  })

  it('activates with subprocess isolation once the bundled CLI path resolves', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    const fiber = await ctx.plugin(ToolCodegraph, { isolation: 'subprocess' })
    expect(ctx.tools.get('codegraph_explore')).toBeDefined()
    await fiber.dispose()
  })
})
