import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { apply, inject } from '../src/client/index.ts'
import { en, zh } from '../src/client/locales.ts'
import { SshSection } from '../src/client/section.tsx'
import type { SshInjected } from '../src/client/section.tsx'

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
  const failure = { ok: false as const, error: { code: 'Error', message: 'unused', details: {} } }
  const list = vi.fn(async () => failure)
  const put = vi.fn(async () => failure)
  const remove = vi.fn(async () => failure)
  const exec = vi.fn(async () => failure)
  ctx.provide('remote.ssh', { list, put, remove, exec })
  return { ctx, locale, slots: ctx.get('slots') as SlotRegistry, list, put, remove, exec }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-ssh apply', () => {
  it('declares its injected services', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.ssh'])
  })

  it('registers the settings section and wires every Remote verb through its inject face', async () => {
    const { ctx, locale, slots, list, put, remove, exec } = await bench()
    locale.setLocale('zh')
    declare(slots)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    const entry = slots.entries('settings.section')[0]!
    expect(entry.component).toBe(SshSection)
    expect(entry.options).toMatchObject({ id: 'ssh', order: 44 })
    expect(resolveSlotLabel(entry.options.label)).toBe('SSH 运维')
    const injected = (entry.inject as unknown as () => SshInjected)()
    await injected.list()
    expect(list).toHaveBeenCalledTimes(1)
    const record = { id: 'h-1', alias: 'prod', host: '10.0.0.1', port: 22, user: 'root', password: 'secret' }
    await injected.put(record)
    expect(put).toHaveBeenCalledWith(record)
    await injected.remove('h-1')
    expect(remove).toHaveBeenCalledWith('h-1')
    await injected.exec('h-1', 'ls -la')
    expect(exec).toHaveBeenCalledWith('h-1', 'ls -la')

    await fiber.dispose()
    expect(slots.entries('settings.section')).toHaveLength(0)
    expect(() => locale.register('ssh', { zh, en })).not.toThrow()
  })
})
