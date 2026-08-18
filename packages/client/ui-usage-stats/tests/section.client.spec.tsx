// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UsageStatsSection, modelSegments } from '../src/client/section.tsx'
import type { ModelUsage, Stats, UsageDay, UsageStatsInjected } from '../src/client/section.tsx'

afterEach(cleanup)
const t = (key: string) => key
const buckets = { uncachedInputTokens: 10, outputTokens: 5, cacheReadTokens: 3, cacheWriteTokens: 2, reasoningTokens: 4 }
const day = (date: string, totalTokens = 20): UsageDay => ({ date, ...buckets, totalTokens, sessionCount: 1, messageCount: 2 })
const model = (index: number, totalTokens: number): ModelUsage => ({ provider: `p${index}`, model: `m${index}`, ...buckets, totalTokens, sessionCount: 1 })
const dateAt = (days: number, index: number): string => {
  const value = new Date(2026, 7, 18 - days + index + 1)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}
const snapshot = (days: 7 | 30 = 30): Stats => ({
  days, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, startDate: '2026-08-12', endDate: '2026-08-18', generatedAt: Date.now(),
  ...buckets, totalTokens: 20, sessionCount: 2, messageCount: 4, activeDays: 2, currentStreakDays: 1,
  daily: Array.from({ length: days }, (_, index) => day(dateAt(days, index), index === days - 1 ? 20 : 0)),
  models: [model(1, 10), model(2, 4), model(3, 3), model(4, 2), model(5, 1)],
})

function ok(value: Stats) { return Promise.resolve({ ok: true as const, value }) }
function renderSection(stats: UsageStatsInjected['stats']) {
  return render(<UsageStatsSection t={t as never} stats={stats} />)
}

describe('UsageStatsSection', () => {
  it('shows a stable skeleton, then KPIs, accessible charts, and detail tables', async () => {
    let resolve!: (value: Awaited<ReturnType<UsageStatsInjected['stats']>>) => void
    const stats = vi.fn<UsageStatsInjected['stats']>(() => new Promise((done) => { resolve = done }))
    renderSection(stats)
    expect(screen.getByLabelText('loading').getAttribute('aria-busy')).toBe('true')
    resolve({ ok: true, value: snapshot() })
    await waitFor(() => { expect(screen.getByText('kpi.tokens')).toBeTruthy() })
    expect(screen.getByRole('img', { name: 'models.summary' })).toBeTruthy()
    fireEvent.click(screen.getByText('details'))
    expect(screen.getByText('models.table')).toBeTruthy()
    expect(screen.getByText('daily.table')).toBeTruthy()
  })

  it('switches ranges and refreshes without hiding the retained result', async () => {
    let secondResolve!: (value: Awaited<ReturnType<UsageStatsInjected['stats']>>) => void
    const stats = vi.fn((_request: { days: 7 | 30 }) => stats.mock.calls.length === 1
      ? ok(snapshot(30))
      : new Promise((done) => { secondResolve = done }))
    renderSection(stats as UsageStatsInjected['stats'])
    await screen.findByText('kpi.tokens')
    fireEvent.click(screen.getByRole('button', { name: 'range.7' }))
    expect(screen.getByText('updating')).toBeTruthy()
    expect(screen.getByText('kpi.tokens')).toBeTruthy()
    secondResolve({ ok: true, value: snapshot(7) })
    await waitFor(() => { expect(stats).toHaveBeenLastCalledWith({ days: 7 }) })
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
    expect(stats).toHaveBeenLastCalledWith({ days: 7 })
  })

  it('keeps old data on failure and exposes retry', async () => {
    const stats = vi.fn()
      .mockImplementationOnce(() => ok(snapshot(30)))
      .mockResolvedValueOnce({ ok: false, error: { name: 'Error', message: 'disk offline' } })
      .mockImplementationOnce(() => ok(snapshot(30)))
    renderSection(stats as UsageStatsInjected['stats'])
    await screen.findByText('kpi.tokens')
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
    await screen.findByText(/disk offline/)
    expect(screen.getByText('kpi.tokens')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => { expect(stats).toHaveBeenCalledTimes(3) })
  })

  it('ignores an older response after a newer range selection', async () => {
    const pending: ((value: Awaited<ReturnType<UsageStatsInjected['stats']>>) => void)[] = []
    let callCount = 0
    const stats = vi.fn<UsageStatsInjected['stats']>(() => {
      callCount++
      return callCount === 1 ? ok(snapshot(30)) : new Promise((done) => { pending.push(done) })
    })
    renderSection(stats)
    await screen.findByText('kpi.tokens')
    fireEvent.click(screen.getByRole('button', { name: 'range.7' }))
    fireEvent.click(screen.getByRole('button', { name: 'range.30' }))
    pending[1]?.({ ok: true, value: { ...snapshot(30), messageCount: 30 } })
    pending[0]?.({ ok: true, value: { ...snapshot(7), messageCount: 7 } })
    await waitFor(() => { expect(screen.getByLabelText('30')).toBeTruthy() })
    expect(screen.queryByLabelText('7')).toBeNull()
  })

  it('shows explicit no-usage copy while retaining message activity', async () => {
    const emptyBuckets = {
      uncachedInputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    }
    renderSection(() => ok({
      ...snapshot(7),
      totalTokens: 0,
      models: [],
      daily: snapshot(7).daily.map(value => ({ ...value, ...emptyBuckets, totalTokens: 0 })),
    }))
    expect(await screen.findByText('trend.noUsage')).toBeTruthy()
    expect(screen.getByText('models.empty')).toBeTruthy()
  })
})

describe('modelSegments', () => {
  it('keeps four models and combines the rest', () => {
    expect(modelSegments([model(1, 5), model(2, 4), model(3, 3), model(4, 2), model(5, 1), model(6, 1)])).toEqual([
      expect.objectContaining({ model: 'm1', totalTokens: 5 }), expect.objectContaining({ model: 'm2' }), expect.objectContaining({ model: 'm3' }), expect.objectContaining({ model: 'm4' }), { provider: '', model: 'other', totalTokens: 2 },
    ])
  })
})
