import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { apply, inject } from '../src/client/index.ts'
import { en, zh } from '../src/client/locales.ts'
import { WorkspaceInspectorSection } from '../src/client/section.tsx'
import type { WorkspaceInspectorInjected } from '../src/client/section.tsx'

async function bench(workspaceIds: readonly string[] = ['ws-1']) {
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
  const failure = { ok: false as const, error: { code: 'Error', message: 'unused', details: {} } }
  const tree = vi.fn(async () => failure)
  const preview = vi.fn(async () => failure)
  const search = vi.fn(async () => failure)
  ctx.provide('remote.workspaceFiles', { tree, preview, search })
  ctx.provide('workspaces', {
    list: { getSnapshot: () => ({ items: workspaceIds.map(workspaceId => ({ workspaceId })) }) },
  } as never)
  return { ctx, locale, slots: ctx.get('slots') as SlotRegistry, tree, preview, search }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-workspace-inspector apply', () => {
  it('declares its injected services', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.workspaceFiles', 'workspaces'])
  })

  it('registers the settings section and wires every Remote verb through its inject face', async () => {
    const { ctx, locale, slots, tree, preview, search } = await bench()
    locale.setLocale('zh')
    declare(slots)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    const entry = slots.entries('settings.section')[0]!
    expect(entry.component).toBe(WorkspaceInspectorSection)
    expect(entry.options).toMatchObject({ id: 'workspace-inspector', order: 43 })
    expect(resolveSlotLabel(entry.options.label)).toBe('文件检查器')
    const injected = (entry.inject as unknown as () => WorkspaceInspectorInjected)()
    await injected.tree('ws-1', 'src')
    expect(tree).toHaveBeenCalledWith('ws-1', 'src')
    await injected.preview('ws-1', 'src/a.ts')
    expect(preview).toHaveBeenCalledWith('ws-1', 'src/a.ts')
    await injected.search('ws-1', 'readme')
    expect(search).toHaveBeenCalledWith('ws-1', 'readme')
    expect(injected.workspaceId()).toBe('ws-1')

    await fiber.dispose()
    expect(slots.entries('settings.section')).toHaveLength(0)
    expect(() => locale.register('workspaceinspector', { zh, en })).not.toThrow()
  })
})
