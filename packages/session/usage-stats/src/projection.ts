/** Pure historical usage projection over immutable session events. */
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type {
  UsageStatsDay,
  UsageStatsDays,
  UsageStatsModel,
  UsageStatsSnapshot,
  UsageTokenBuckets,
} from './types.ts'

type MutableBuckets = UsageTokenBuckets
interface UsageContribution extends MutableBuckets { date: string; provider: string; model: string }
interface MutableDay extends MutableBuckets { messageCount: number; usageCount: number }
interface MutableModel extends MutableBuckets { usageCount: number }

/** Incrementally foldable state for one session. */
export interface SessionUsageProjection {
  /** Number of events already consumed. */
  seq: number
  /** Per-day activity and token totals. */
  days: Map<string, MutableDay>
  /** Per-day, per-model token totals. */
  modelsByDay: Map<string, Map<string, MutableModel>>
  /** Current request route for usage chunks. */
  route?: { provider: string; model: string }
  /** Most recent usage sample, replaceable within its turn/step. */
  lastUsage?: { turn: number; step: number; value: UsageContribution }
}

const zeroBuckets = (): MutableBuckets => ({
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
})

/**
 * Create an empty incremental session projection.
 * @returns Mutable state ready to consume event sequence zero.
 */
export function createSessionUsageProjection(): SessionUsageProjection {
  return { seq: 0, days: new Map(), modelsByDay: new Map() }
}

function dayFor(state: SessionUsageProjection, date: string): MutableDay {
  let day = state.days.get(date)
  if (day === undefined) {
    day = { ...zeroBuckets(), messageCount: 0, usageCount: 0 }
    state.days.set(date, day)
  }
  return day
}

function modelFor(state: SessionUsageProjection, value: UsageContribution): MutableModel {
  let models = state.modelsByDay.get(value.date)
  if (models === undefined) {
    models = new Map()
    state.modelsByDay.set(value.date, models)
  }
  const key = `${value.provider}\u0000${value.model}`
  let model = models.get(key)
  if (model === undefined) {
    model = { ...zeroBuckets(), usageCount: 0 }
    models.set(key, model)
  }
  return model
}

function applyContribution(target: MutableBuckets, value: UsageTokenBuckets, direction: 1 | -1): void {
  target.uncachedInputTokens += direction * value.uncachedInputTokens
  target.outputTokens += direction * value.outputTokens
  target.cacheReadTokens += direction * value.cacheReadTokens
  target.cacheWriteTokens += direction * value.cacheWriteTokens
  target.reasoningTokens += direction * value.reasoningTokens
}

function recordUsage(state: SessionUsageProjection, turn: number, step: number, value: UsageContribution): void {
  const previous = state.lastUsage?.turn === turn && state.lastUsage.step === step ? state.lastUsage.value : undefined
  if (previous !== undefined) {
    const oldDay = dayFor(state, previous.date)
    const oldModel = modelFor(state, previous)
    applyContribution(oldDay, previous, -1)
    applyContribution(oldModel, previous, -1)
    oldDay.usageCount--
    oldModel.usageCount--
  }
  const day = dayFor(state, value.date)
  const model = modelFor(state, value)
  applyContribution(day, value, 1)
  applyContribution(model, value, 1)
  day.usageCount++
  model.usageCount++
  state.lastUsage = { turn, step, value }
}

/**
 * Convert one timestamp to a Host-local ISO calendar date.
 * @param timestamp - Unix timestamp in milliseconds.
 * @returns Calendar key in `YYYY-MM-DD` form.
 */
export function localDateKey(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear().toString().padStart(4, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

function checkedUsage(
  event: SessionEvent<'assistant/chunk'> | SessionEvent<'assistant/message'>,
): UsageTokenBuckets | undefined {
  const usage = event.type === 'assistant/chunk' && event.data.chunk.type === 'usage'
    ? event.data.chunk.usage
    : event.type === 'assistant/message' ? event.data.usage : undefined
  if (usage === undefined) return undefined
  const fields = [
    usage.inputTokens,
    usage.outputTokens,
    usage.cacheReadTokens ?? 0,
    usage.cacheWriteTokens ?? 0,
    usage.reasoningTokens ?? 0,
  ]
  if (fields.some(value => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`usage-stats: event ${event.seq} has invalid token usage`)
  }
  return {
    uncachedInputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
    reasoningTokens: usage.reasoningTokens ?? 0,
  }
}

/**
 * Fold a contiguous immutable event suffix into one session projection.
 * @param state - Projection whose `seq` identifies the required first event.
 * @param events - Contiguous immutable suffix to consume in sequence order.
 * @returns The mutated projection supplied in `state`.
 */
export function foldSessionUsage(state: SessionUsageProjection, events: readonly SessionEvent[]): SessionUsageProjection {
  for (const event of events) {
    if (event.seq !== state.seq) throw new Error(`usage-stats: expected event seq ${state.seq}, got ${event.seq}`)
    state.seq++
    if (event.type === 'request/header') {
      state.route = { provider: event.data.header.config.provider, model: event.data.header.config.model }
      continue
    }
    if (event.type === 'user/message' && event.data.source.kind === 'user') {
      dayFor(state, localDateKey(event.time)).messageCount++
      continue
    }
    if (event.type === 'assistant/message' && event.data.message.content.length > 0) {
      dayFor(state, localDateKey(event.time)).messageCount++
    }
    if (event.type !== 'assistant/chunk' && event.type !== 'assistant/message') continue
    const buckets = checkedUsage(event)
    if (buckets === undefined) continue
    const finalRoute = event.type === 'assistant/message' ? event.data.message.source : undefined
    const route = finalRoute ?? state.route ?? { provider: 'unknown', model: 'unknown' }
    recordUsage(state, event.data.turn, event.data.step, {
      ...buckets,
      date: localDateKey(event.time),
      provider: route.provider,
      model: route.model,
    })
  }
  return state
}

const addDays = (date: Date, amount: number): Date => {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}
const totalOf = (value: UsageTokenBuckets): number => value.uncachedInputTokens
  + value.outputTokens
  + value.cacheReadTokens
  + value.cacheWriteTokens

/**
 * Build the selected-range snapshot from all per-session projections.
 * @param projections - Complete current projections for distinct local sessions.
 * @param days - Inclusive seven- or thirty-day range ending today.
 * @param generatedAt - Timestamp that fixes today and the response generation time.
 * @returns Dense Host-calendar activity and provider-reported Token totals.
 */
export function buildUsageSnapshot(
  projections: readonly SessionUsageProjection[],
  days: UsageStatsDays,
  generatedAt = Date.now(),
): UsageStatsSnapshot {
  const today = new Date(generatedAt)
  today.setHours(0, 0, 0, 0)
  const first = addDays(today, -(days - 1))
  const startDate = localDateKey(first.getTime())
  const endDate = localDateKey(today.getTime())
  const dateKeys = Array.from({ length: days }, (_, index) => localDateKey(addDays(first, index).getTime()))
  const selected = new Set(dateKeys)
  const totals = zeroBuckets()
  const daily: UsageStatsDay[] = dateKeys.map(date => ({
    date,
    ...zeroBuckets(),
    totalTokens: 0,
    sessionCount: 0,
    messageCount: 0,
  }))
  const dailyByDate = new Map(daily.map(day => [day.date, day]))
  const models = new Map<string, UsageStatsModel>()
  let sessionCount = 0
  let messageCount = 0
  const activeDates = new Set<string>()
  for (const projection of projections) {
    let sessionActive = false
    const sessionModels = new Set<string>()
    for (const [date, source] of projection.days) {
      if (source.messageCount > 0) activeDates.add(date)
      if (!selected.has(date)) continue
      const target = dailyByDate.get(date)
      if (target === undefined) continue
      applyContribution(target, source, 1)
      target.messageCount += source.messageCount
      messageCount += source.messageCount
      if (source.messageCount > 0 || source.usageCount > 0) {
        target.sessionCount++
        sessionActive = true
      }
    }
    for (const [date, sourceModels] of projection.modelsByDay) {
      if (!selected.has(date)) continue
      for (const [key, source] of sourceModels) {
        if (source.usageCount === 0) continue
        const separator = key.indexOf('\u0000')
        const provider = key.slice(0, separator)
        const model = key.slice(separator + 1)
        let target = models.get(key)
        if (target === undefined) {
          target = { provider, model, ...zeroBuckets(), totalTokens: 0, sessionCount: 0 }
          models.set(key, target)
        }
        applyContribution(target, source, 1)
        sessionModels.add(key)
      }
    }
    if (sessionActive) sessionCount++
    for (const key of sessionModels) {
      const model = models.get(key)
      if (model !== undefined) model.sessionCount++
    }
  }
  for (const day of daily) {
    day.totalTokens = totalOf(day)
    applyContribution(totals, day, 1)
  }
  const sortedModels = [...models.values()]
    .map(model => ({ ...model, totalTokens: totalOf(model) }))
    .sort((left, right) => right.totalTokens - left.totalTokens
      || left.provider.localeCompare(right.provider)
      || left.model.localeCompare(right.model))
  let currentStreakDays = 0
  for (let cursor = today; activeDates.has(localDateKey(cursor.getTime())); cursor = addDays(cursor, -1)) {
    currentStreakDays++
  }
  return {
    days,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    startDate,
    endDate,
    generatedAt,
    ...totals,
    totalTokens: totalOf(totals),
    sessionCount,
    messageCount,
    activeDays: dateKeys.filter(date => activeDates.has(date)).length,
    currentStreakDays,
    daily,
    models: sortedModels,
  }
}
