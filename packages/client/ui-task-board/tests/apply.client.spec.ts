import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { apply, inject } from '../src/client/index.ts'
import { en, zh } from '../src/client/locales.ts'
import { TaskBoardSection } from '../src/client/section.tsx'
import type { TaskBoardInjected } from '../src/client/section.tsx'

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
  const create = vi.fn(async () => failure)
  const archive = vi.fn(async () => failure)
  const update = vi.fn(async () => failure)
  const remove = vi.fn(async () => failure)
  ctx.provide('remote.taskBoard', { list, create, archive, update, remove })
  return { ctx, locale, slots: ctx.get('slots') as SlotRegistry, list, create, archive, update, remove }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-task-board apply', () => {
  it('declares its injected services', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.taskBoard'])
  })

  it('registers the settings section and wires every Remote verb through its inject face', async () => {
    const { ctx, locale, slots, list, create, archive, update, remove } = await bench()
    locale.setLocale('zh')
    declare(slots)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    const entry = slots.entries('settings.section')[0]!
    expect(entry.component).toBe(TaskBoardSection)
    expect(entry.options).toMatchObject({ id: 'task-board', order: 41 })
    expect(resolveSlotLabel(entry.options.label)).toBe('任务看板')
    const injected = (entry.inject as unknown as () => TaskBoardInjected)()
    await injected.list()
    expect(list).toHaveBeenCalledTimes(1)
    await injected.create('title', 'req-1')
    expect(create).toHaveBeenCalledWith('title', 'req-1')
    await injected.archive('t-1', 'req-2')
    expect(archive).toHaveBeenCalledWith('t-1', 'req-2')
    await injected.update('t-1', 'renamed', 'req-3')
    expect(update).toHaveBeenCalledWith('t-1', 'renamed', 'req-3')
    await injected.remove('t-1', 'req-4')
    expect(remove).toHaveBeenCalledWith('t-1', 'req-4')

    await fiber.dispose()
    expect(slots.entries('settings.section')).toHaveLength(0)
    expect(() => locale.register('taskboard', { zh, en })).not.toThrow()
  })
})
