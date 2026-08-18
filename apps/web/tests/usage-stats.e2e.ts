// Web e2e: real Host session logs through the usage Remote into the settings dashboard.
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed, vi } from 'vitest'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import {
  assertFixtureInventory, captureStableAria, compareOrRefreshGolden,
  launchWebScaffold, watchConsole, webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { ZH_BROWSER_LOCALE, saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/usage-stats', import.meta.url))
const THIRTY_EXPECTED = join(SNAPSHOT_DIR, '30-days.expected.md')
const SEVEN_EXPECTED = join(SNAPSHOT_DIR, '7-days.expected.md')
const MODE = webSnapshotMode()
const now = vi.spyOn(Date, 'now')

function appendUsage(session: Session, date: string, provider: string, model: string, inputTokens: number, outputTokens: number): void {
  now.mockReturnValue(new Date(`${date}T12:00:00+08:00`).getTime())
  session.append('user/message', createUserMessage({ content: [{ type: 'text', text: `${model} prompt` }], source: { kind: 'user' } }), { surfaceOp: 'append' })
  session.append('request/header', { header: { config: { provider, model }, system: '', tools: [] }, reason: 'change' })
  session.append('assistant/message', {
    turn: session.seq, step: 1,
    message: createAssistantMessage({ content: [{ type: 'text', text: `${model} answer` }], source: { provider, model } }),
    usage: { inputTokens, outputTokens, cacheReadTokens: 3, reasoningTokens: 2 },
  }, { surfaceOp: 'append', sourceEventSeqs: [] })
}

describe('web e2e: local usage history dashboard', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    now.mockReturnValue(new Date('2026-08-18T12:00:00+08:00').getTime())
    scaffold = await launchWebScaffold({})
    const cold = scaffold.ctx.sessions.prepare(SessionId('usage-cold-unassigned'))
    const detach = scaffold.ctx.sessions.enter(cold)
    scaffold.ctx.sessions.announce(cold)
    appendUsage(cold, '2026-07-30', 'deepseek', 'deepseek-chat', 90, 20)
    await scaffold.ctx.sessions.flush(cold)
    detach()
    const live = scaffold.ctx.sessions.create(SessionId('usage-live-unassigned'))
    appendUsage(live, '2026-08-16', 'deepseek', 'deepseek-reasoner', 50, 15)
    appendUsage(live, '2026-08-18', 'openai-compatible', 'local-model', 30, 10)
    now.mockReturnValue(new Date('2026-08-18T12:00:00+08:00').getTime())
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: ZH_BROWSER_LOCALE })
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
    now.mockRestore()
  })

  it('renders 30/7-day history and stays console-clean in both themes', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-usage-stats'))
    await page.getByRole('button', { name: '设置', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '设置' })
    await dialog.getByRole('button', { name: '用量统计' }).click()
    const section = page.locator('[data-usage-stats]')
    await section.getByText('Token 总量').waitFor({ timeout: 15_000 })
    const thirty = await captureStableAria(page, '[data-usage-stats]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(THIRTY_EXPECTED, thirty, MODE)
    await section.getByRole('button', { name: '最近 7 天' }).click()
    await expect.poll(() => section.getByRole('button', { name: '最近 7 天' }).getAttribute('aria-pressed'), { timeout: 10_000 }).toBe('true')
    // SegmentedRange commits aria-pressed before the range reload settles;
    // wait for the 7-day KPI so captureStableAria does not snapshot the
    // still-updating 30-day dashboard.
    await expect.poll(() => section.getByText('2 / 7').count(), { timeout: 10_000 }).toBe(1)
    const seven = await captureStableAria(page, '[data-usage-stats]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(SEVEN_EXPECTED, seven, MODE)
    await page.evaluate(() => { document.body.setAttribute('data-ds-dark-theme', '') })
    await expect.poll(() => page.locator('[data-usage-stats]').count()).toBe(1)
    await page.evaluate(() => { document.body.removeAttribute('data-ds-dark-theme') })
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
    await assertFixtureInventory(SNAPSHOT_DIR, ['30-days.expected.md', '7-days.expected.md'])
  }, 60_000)
})
