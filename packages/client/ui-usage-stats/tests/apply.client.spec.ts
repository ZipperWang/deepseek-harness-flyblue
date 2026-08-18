import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { apply, inject } from '../src/client/index.ts'
import { en, zh } from '../src/client/locales.ts'
import { UsageStatsSection } from '../src/client/section.tsx'
import type { UsageStatsInjected } from '../src/client/section.tsx'

async function bench() {
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
  const stats = vi.fn(async () => ({ ok: false as const, error: { name: 'Error', message: 'unused' } }))
  ctx.provide('remote.usageStats', { stats })
  return { ctx, locale, slots: ctx.get('slots') as SlotRegistry, stats }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-usage-stats apply', () => {
  it('declares its injected services', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.usageStats'])
  })

  it('registers the settings section and disposes its slot and dictionaries', async () => {
    const { ctx, locale, slots, stats } = await bench()
    locale.setLocale('zh')
    declare(slots)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    const entry = slots.entries('settings.section')[0]!
    expect(entry.component).toBe(UsageStatsSection)
    expect(entry.options).toMatchObject({ id: 'usage-stats', order: 40 })
    expect(resolveSlotLabel(entry.options.label)).toBe('用量统计')
    const injected = (entry.inject as unknown as () => UsageStatsInjected)()
    await injected.stats({ days: 7 })
    expect(stats).toHaveBeenCalledWith({ days: 7 })

    await fiber.dispose()
    expect(slots.entries('settings.section')).toHaveLength(0)
    expect(() => locale.register('usageStats', { zh, en })).not.toThrow()
  })
})
