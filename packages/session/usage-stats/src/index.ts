/** Historical local-session usage statistics. */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { Session, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionPersistenceRevision, SessionPersistenceSnapshot } from '@deepseek-ai/dsh-session-persistence'
import { buildUsageSnapshot, createSessionUsageProjection, foldSessionUsage } from './projection.ts'
import type { SessionUsageProjection } from './projection.ts'
import type { UsageStatsRequest, UsageStatsSnapshot } from './types.ts'

export type { UsageStatsDay, UsageStatsDays, UsageStatsModel, UsageStatsRequest, UsageStatsSnapshot, UsageTokenBuckets } from './types.ts'

/** Default number of cold session logs inspected concurrently. */
export const DEFAULT_INSPECT_CONCURRENCY = 4

/** Configures bounded cold-session inspection. */
export interface Config {
  /** Maximum persistence inspections in flight. */
  inspectConcurrency?: number
}

/** Runtime schema for usage-stat settings. */
export const Config: z<Config> = z.object({ inspectConcurrency: z.natural().min(1).max(32).default(DEFAULT_INSPECT_CONCURRENCY) })

declare module '@deepseek-ai/cordis' { interface Context { usageStats: UsageStatsService } }

type CachedSession =
  | { kind: 'live'; session: Session; projection: SessionUsageProjection }
  | { kind: 'cold'; revision: SessionPersistenceRevision; projection: SessionUsageProjection }

async function mapConcurrent<T>(values: readonly T[], concurrency: number, run: (value: T) => Promise<void>): Promise<void> {
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < values.length) {
      const index = next++
      const value = values[index]
      /* v8 ignore next -- the claimed index is always inside values. */
      if (value !== undefined) await run(value)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker))
}

/**
 * Derives browser-safe historical accounting from every local session log.
 * The service reads no credentials, plans, balances, prices, or quotas.
 * @typert service usageStats
 */
export class UsageStatsService extends TypertRemoteService {
  static inject = ['sessionPersistence', 'sessions']
  private readonly cache = new Map<SessionId, CachedSession>()
  private readonly inspectConcurrency: number

  /** @param ctx - Context carrying live sessions and durable persistence. @param config - Bounded inspection configuration. */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'usageStats')
    this.inspectConcurrency = config.inspectConcurrency ?? DEFAULT_INSPECT_CONCURRENCY
  }

  /**
   * Read one consistent per-session scan for the requested Host calendar range.
   * @param request - Seven- or thirty-day inclusive range.
   * @returns Dense daily activity and provider-reported usage.
   */
  @Remote
  async stats(request: UsageStatsRequest): Promise<UsageStatsSnapshot> {
    const generatedAt = Date.now()
    const [liveSessions, storedSnapshots] = await Promise.all([
      Promise.resolve(this.ctx.sessions.list()),
      this.ctx.sessionPersistence.listSnapshots(),
    ])
    const liveById = new Map(liveSessions.map(session => [session.id, session]))
    const storedById = new Map(storedSnapshots.map(snapshot => [snapshot.header.id, snapshot]))
    const present = new Set<SessionId>([...liveById.keys(), ...storedById.keys()])
    for (const [id, session] of liveById) {
      const cached = this.cache.get(id)
      const projection = cached?.kind === 'live' && cached.session === session && cached.projection.seq <= session.seq
        ? cached.projection
        : createSessionUsageProjection()
      foldSessionUsage(projection, session.events.slice(projection.seq))
      this.cache.set(id, { kind: 'live', session, projection })
    }
    const cold = [...storedById.values()].filter(snapshot => !liveById.has(snapshot.header.id))
    await mapConcurrent(cold, this.inspectConcurrency, async (snapshot: SessionPersistenceSnapshot) => {
      const cached = this.cache.get(snapshot.header.id)
      if (cached?.kind === 'cold' && cached.revision === snapshot.revision) return
      const inspected = await this.ctx.sessionPersistence.inspect(snapshot.header.id)
      const projection = foldSessionUsage(createSessionUsageProjection(), inspected.events)
      this.cache.set(snapshot.header.id, { kind: 'cold', revision: snapshot.revision, projection })
    })
    for (const id of this.cache.keys()) if (!present.has(id)) this.cache.delete(id)
    const projections = [...present].map(id => this.cache.get(id)?.projection ?? createSessionUsageProjection())
    return buildUsageSnapshot(projections, request.days, generatedAt)
  }
}

export default UsageStatsService
