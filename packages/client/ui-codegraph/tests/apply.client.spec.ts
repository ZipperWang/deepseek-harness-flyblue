import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { stubSettingsScope, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import type { CodegraphSettings } from '@deepseek-ai/dsh-codegraph-index/client'
import { apply, inject } from '../src/client/index.ts'
import { CodegraphDock } from '../src/client/CodegraphDock.tsx'
import { CodegraphSection } from '../src/client/CodegraphSection.tsx'
import type { CodegraphDockInjected } from '../src/client/CodegraphDock.tsx'
import type { CodegraphSectionInjected } from '../src/client/CodegraphSection.tsx'

usePinnedBrowserLanguages('zh-CN')

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.provide('locale', new LocaleRuntime(ctx))
  const scope = stubSettingsScope<CodegraphSettings>()
  ctx.provide('settingsScope', { bind: () => scope.scope } as never)
  const status = vi.fn(async () => ({
    ok: true as const,
    value: { projectPath: '/repo', indexed: false, indexing: false },
  }))
  const init = vi.fn(async () => ({
    ok: true as const,
    value: { projectPath: '/repo', indexed: false, indexing: true },
  }))
  class RemoteService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'remote')
    }
  }
  new RemoteService(ctx)
  ctx.provide('remote.codegraphIndex', { status, init })
  return { ctx, slots: ctx.get('slots') as SlotRegistry, scope, status, init }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: {
      'settings.section': { kind: 'list', scope: 'root' },
      'conversation.input.dock': { kind: 'list', scope: 'session' },
    },
  } as never, () => null)
}

describe('ui-codegraph apply', () => {
  it('declares the services it uses', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.codegraphIndex', 'settingsScope'])
  })

  it('registers the settings page and dock prompt', async () => {
    const { ctx, slots, scope } = await bench()
    declare(slots)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    const section = slots.entries('settings.section')[0]!
    expect(section.component).toBe(CodegraphSection)
    expect(section.options).toMatchObject({ id: 'codegraph', order: 25 })
    expect(resolveSlotLabel(section.options.label)).toBe('代码索引')
    const sectionFace = (section.inject as unknown as () => CodegraphSectionInjected)()
    sectionFace.setAutoInit(true)
    expect(scope.set).toHaveBeenCalledWith('autoInit', true)

    const dock = slots.entries('conversation.input.dock')[0]!
    expect(dock.component).toBe(CodegraphDock)
    expect(dock.options).toMatchObject({ id: 'codegraph-index', order: 5 })
    const dockFace = (dock.inject as unknown as () => CodegraphDockInjected)()
    expect(typeof dockFace.status).toBe('function')
    expect(typeof dockFace.init).toBe('function')

    await fiber.dispose()
    expect(slots.entries('settings.section')).toHaveLength(0)
    expect(slots.entries('conversation.input.dock')).toHaveLength(0)
  })

  it('recovers after the declaring slots remount', async () => {
    const { ctx, slots } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    expect(slots.entries('settings.section')).toHaveLength(0)
    declare(slots)
    await Promise.resolve()
    expect(slots.entries('settings.section')[0]!.component).toBe(CodegraphSection)
    expect(slots.entries('conversation.input.dock')[0]!.component).toBe(CodegraphDock)
  })
})
