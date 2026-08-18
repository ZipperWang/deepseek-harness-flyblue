import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SESSION_FORMAT_VERSION, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import SessionPersistence, { SessionPersistenceRevision } from '@deepseek-ai/dsh-session-persistence'
import UsageStatsService from '../src/index.ts'

interface Stored { header: SessionHeader; revision: string; events: SessionEvent[] }

class FakePersistence extends SessionPersistence {
  readonly supportsRawArtifacts = false
  readonly stored = new Map<string, Stored>()
  inspections = 0
  active = 0
  maxActive = 0
  fail?: Error
  locate(): undefined { return undefined }
  async create(): Promise<void> {}
  async append(): Promise<void> {}
  async load(id: ReturnType<typeof SessionId>) { return this.inspect(id) }
  async inspect(id: ReturnType<typeof SessionId>) {
    this.inspections++
    this.active++
    this.maxActive = Math.max(this.maxActive, this.active)
    await new Promise(resolve => setTimeout(resolve, 1))
    this.active--
    if (this.fail !== undefined) throw this.fail
    const value = this.stored.get(id)
    if (value === undefined) throw new Error('missing')
    return { meta: value.header, events: value.events }
  }
  async readFrom(id: ReturnType<typeof SessionId>, fromSeq: number) {
    const value = await this.inspect(id)
    return { meta: value.meta, events: [...value.events.slice(fromSeq)] }
  }
  async list(): Promise<SessionHeader[]> { return [...this.stored.values()].map(value => value.header) }
  async listSnapshots() {
    return [...this.stored.values()].map(value => ({
      header: value.header,
      revision: SessionPersistenceRevision(value.revision),
    }))
  }
}

const contexts: Context[] = []
afterEach(async () => { await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose())) })

async function harness(concurrency = 2) {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SessionStore)
  await ctx.plugin(FakePersistence)
  await ctx.plugin(UsageStatsService, { inspectConcurrency: concurrency })
  return { ctx, persistence: ctx.sessionPersistence as FakePersistence }
}

function stored(id: string, revision: string, time: number): Stored {
  const sessionId = SessionId(id)
  return {
    header: { version: SESSION_FORMAT_VERSION, id: sessionId, createdAt: time }, revision,
    events: [{ type: 'user/message', seq: 0, time, data: { id: `m-${id}`, role: 'user', content: [{ type: 'text', text: id }], source: { kind: 'user' } }, surfaceOp: 'append' } as SessionEvent],
  }
}

describe('UsageStatsService', () => {
  it('unions live and cold sessions, lets live identity win, and reuses revisions', async () => {
    const { ctx, persistence } = await harness()
    const now = Date.now()
    const live = ctx.sessions.create(SessionId('same'))
    live.append('user/message', createUserMessage({ content: [{ type: 'text', text: 'live' }], source: { kind: 'user' } }), { surfaceOp: 'append' })
    persistence.stored.set('same', stored('same', 'r1', now))
    persistence.stored.set('cold', stored('cold', 'r1', now))
    const first = await ctx.usageStats.stats({ days: 7 })
    expect(first).toMatchObject({ sessionCount: 2, messageCount: 2 })
    expect(persistence.inspections).toBe(1)
    await ctx.usageStats.stats({ days: 7 })
    expect(persistence.inspections).toBe(1)
    persistence.stored.get('cold')!.revision = 'r2'
    await ctx.usageStats.stats({ days: 7 })
    expect(persistence.inspections).toBe(2)
  })

  it('bounds cold inspection concurrency and propagates storage failures', async () => {
    const { ctx, persistence } = await harness(2)
    const now = Date.now()
    for (let index = 0; index < 6; index++) persistence.stored.set(`s${index}`, stored(`s${index}`, 'r1', now))
    await ctx.usageStats.stats({ days: 30 })
    expect(persistence.maxActive).toBe(2)
    persistence.stored.get('s0')!.revision = 'r2'
    persistence.fail = new Error('inspection failed')
    await expect(ctx.usageStats.stats({ days: 30 })).rejects.toThrow('inspection failed')
  })

  it('prunes disappeared cache entries', async () => {
    const { ctx, persistence } = await harness()
    persistence.stored.set('cold', stored('cold', 'r1', Date.now()))
    await ctx.usageStats.stats({ days: 7 })
    persistence.stored.clear()
    await ctx.usageStats.stats({ days: 7 })
    persistence.stored.set('cold', stored('cold', 'r1', Date.now()))
    await ctx.usageStats.stats({ days: 7 })
    expect(persistence.inspections).toBe(2)
  })
})
