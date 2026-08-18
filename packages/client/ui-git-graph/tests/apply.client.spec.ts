import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { apply, inject } from '../src/client/index.ts'
import { en, zh } from '../src/client/locales.ts'
import { GitGraphSection } from '../src/client/section.tsx'
import type { GitGraphInjected } from '../src/client/section.tsx'

async function bench(workspaceIds: readonly string[] = []) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  class RemoteService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'remote')
    }
  }
  new RemoteService(ctx)
  const failure = { ok: false as const, error: { name: 'Error', message: 'unused' } }
  const graph = vi.fn(async () => failure)
  const status = vi.fn(async () => failure)
  const branches = vi.fn(async () => failure)
  const createBranch = vi.fn(async () => failure)
  const switchBranch = vi.fn(async () => failure)
  const stage = vi.fn(async () => failure)
  const unstage = vi.fn(async () => failure)
  const discard = vi.fn(async () => failure)
  ctx.provide('remote.workspaceGit', { graph, status, branches, createBranch, switchBranch, stage, unstage, discard })
  ctx.provide('workspaces', {
    list: { getSnapshot: () => ({ items: workspaceIds.map(workspaceId => ({ workspaceId })) }) },
  } as never)
  return { ctx, locale, slots: ctx.get('slots') as SlotRegistry, graph, status, branches, createBranch, switchBranch, stage, unstage, discard }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-git-graph apply', () => {
  it('declares its injected services', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.workspaceGit', 'workspaces'])
  })

  it('registers the settings section and wires every Remote verb through its inject face', async () => {
    const { ctx, locale, slots, graph, status, branches, createBranch, switchBranch, stage, unstage, discard } = await bench(['ws-1'])
    locale.setLocale('zh')
    declare(slots)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    const entry = slots.entries('settings.section')[0]!
    expect(entry.component).toBe(GitGraphSection)
    expect(entry.options).toMatchObject({ id: 'git-graph', order: 42 })
    expect(resolveSlotLabel(entry.options.label)).toBe('Git 图谱')
    const injected = (entry.inject as unknown as () => GitGraphInjected)()
    await injected.graph('ws-1')
    expect(graph).toHaveBeenCalledWith('ws-1')
    await injected.status('ws-1')
    expect(status).toHaveBeenCalledWith('ws-1')
    await injected.branches('ws-1')
    expect(branches).toHaveBeenCalledWith('ws-1')
    await injected.createBranch('ws-1', 'feat')
    expect(createBranch).toHaveBeenCalledWith('ws-1', 'feat')
    await injected.switchBranch('ws-1', 'main')
    expect(switchBranch).toHaveBeenCalledWith('ws-1', 'main')
    await injected.stage('ws-1', 'a.ts')
    expect(stage).toHaveBeenCalledWith('ws-1', 'a.ts')
    await injected.unstage('ws-1', 'a.ts')
    expect(unstage).toHaveBeenCalledWith('ws-1', 'a.ts')
    await injected.discard('ws-1', 'a.ts', true)
    expect(discard).toHaveBeenCalledWith('ws-1', 'a.ts', true)
    expect(injected.workspaceId()).toBe('ws-1')

    await fiber.dispose()
    expect(slots.entries('settings.section')).toHaveLength(0)
    expect(() => locale.register('gitgraph', { zh, en })).not.toThrow()
  })

  it('resolves the workspace id from the shared workspace source', async () => {
    const { ctx, locale, slots } = await bench(['ws-a', 'ws-b'])
    locale.setLocale('en')
    declare(slots)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const entry = slots.entries('settings.section')[0]!
    expect(resolveSlotLabel(entry.options.label)).toBe('Git graph')
    const injected = (entry.inject as unknown as () => GitGraphInjected)()
    expect(injected.workspaceId()).toBe('ws-a')
    await fiber.dispose()
  })

  it('reports no workspace when the shared source is empty', async () => {
    const { ctx, locale, slots } = await bench()
    locale.setLocale('zh')
    declare(slots)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const entry = slots.entries('settings.section')[0]!
    const injected = (entry.inject as unknown as () => GitGraphInjected)()
    expect(injected.workspaceId()).toBeUndefined()
    await fiber.dispose()
  })
})
