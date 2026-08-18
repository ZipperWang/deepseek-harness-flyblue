import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { buildUsageSnapshot, createSessionUsageProjection, foldSessionUsage, localDateKey } from '../src/projection.ts'

const at = (date: string): number => new Date(`${date}T12:00:00`).getTime()
const event = (type: string, seq: number, time: number, data: unknown): SessionEvent => ({ type, seq, time, data } as SessionEvent)
const user = (seq: number, date: string, kind: 'user' | 'plugin' = 'user') => event('user/message', seq, at(date), { id: `u${seq}`, role: 'user', content: [{ type: 'text', text: 'hello' }], source: kind === 'user' ? { kind } : { kind, plugin: 'test' }, surfaceOp: 'append' })
const header = (seq: number, date: string, provider: string, model: string) => event('request/header', seq, at(date), { header: { config: { provider, model }, system: [], tools: [] }, reason: 'initial' })
const usage = (seq: number, date: string, turn: number, step: number, inputTokens: number, outputTokens: number, reasoningTokens = 0) => event('assistant/chunk', seq, at(date), { turn, step, chunk: { type: 'usage', usage: { inputTokens, outputTokens, reasoningTokens } } })
const assistant = (seq: number, date: string, turn: number, step: number, provider: string, model: string, tokens?: { inputTokens: number; outputTokens: number; reasoningTokens?: number }, text = 'answer') => event('assistant/message', seq, at(date), { turn, step, message: { id: `a${seq}`, role: 'assistant', content: text === '' ? [] : [{ type: 'text', text }], source: { kind: 'model', provider, model } }, ...(tokens === undefined ? {} : { usage: tokens }), surfaceOp: 'append', sourceEventSeqs: [] })

afterEach(() => { vi.useRealTimers() })

describe('historical usage projection', () => {
  it('uses Host calendar dates across month boundaries', () => {
    expect(localDateKey(at('2026-07-31'))).toBe('2026-07-31')
    expect(localDateKey(at('2026-08-01'))).toBe('2026-08-01')
    const snapshot = buildUsageSnapshot([], 7, at('2026-08-01'))
    expect(snapshot.daily.map(day => day.date)).toEqual(['2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31', '2026-08-01'])
  })

  it('replaces same-step chunks with final usage and moves model attribution', () => {
    const projection = foldSessionUsage(createSessionUsageProjection(), [
      header(0, '2026-08-18', 'p1', 'm1'),
      usage(1, '2026-08-18', 1, 1, 10, 2, 1),
      assistant(2, '2026-08-18', 1, 1, 'p2', 'm2', { inputTokens: 14, outputTokens: 5, reasoningTokens: 3 }),
    ])
    const snapshot = buildUsageSnapshot([projection], 7, at('2026-08-18'))
    expect(snapshot).toMatchObject({ uncachedInputTokens: 14, outputTokens: 5, reasoningTokens: 3, totalTokens: 19, messageCount: 1 })
    expect(snapshot.models).toEqual([expect.objectContaining({ provider: 'p2', model: 'm2', totalTokens: 19 })])
  })

  it('retains failed-request chunks and excludes reasoning from the total', () => {
    const projection = foldSessionUsage(createSessionUsageProjection(), [header(0, '2026-08-18', 'p', 'm'), usage(1, '2026-08-18', 1, 1, 8, 4, 3)])
    const snapshot = buildUsageSnapshot([projection], 30, at('2026-08-18'))
    expect(snapshot).toMatchObject({ uncachedInputTokens: 8, outputTokens: 4, reasoningTokens: 3, totalTokens: 12, sessionCount: 1 })
  })

  it('counts only direct user and non-empty assistant messages', () => {
    const projection = foldSessionUsage(createSessionUsageProjection(), [
      user(0, '2026-08-18'), user(1, '2026-08-18', 'plugin'), assistant(2, '2026-08-18', 1, 1, 'p', 'm'), assistant(3, '2026-08-18', 1, 2, 'p', 'm', undefined, ''),
    ])
    expect(buildUsageSnapshot([projection], 7, at('2026-08-18'))).toMatchObject({ messageCount: 2, activeDays: 1, currentStreakDays: 1 })
  })

  it('reads the true streak outside the selected range and sorts tied models by identity', () => {
    const events: SessionEvent[] = []
    for (let offset = 0; offset < 9; offset++) events.push(user(offset, `2026-08-${String(18 - offset).padStart(2, '0')}`))
    events.push(header(9, '2026-08-18', 'z', 'm'), usage(10, '2026-08-18', 1, 1, 1, 1), header(11, '2026-08-18', 'a', 'm'), usage(12, '2026-08-18', 2, 1, 1, 1))
    const snapshot = buildUsageSnapshot([foldSessionUsage(createSessionUsageProjection(), events)], 7, at('2026-08-18'))
    expect(snapshot.currentStreakDays).toBe(9)
    expect(snapshot.models.map(model => model.provider)).toEqual(['a', 'z'])
  })

  it('folds a live tail without recounting the prefix and rejects gaps', () => {
    const projection = foldSessionUsage(createSessionUsageProjection(), [user(0, '2026-08-18')])
    foldSessionUsage(projection, [assistant(1, '2026-08-18', 1, 1, 'p', 'm')])
    expect(buildUsageSnapshot([projection], 7, at('2026-08-18')).messageCount).toBe(2)
    expect(() => foldSessionUsage(projection, [user(3, '2026-08-18')])).toThrow('expected event seq 2')
  })
})
