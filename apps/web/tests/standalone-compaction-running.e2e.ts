// Keyless browser pin for standalone compactNow: a handwritten closed turn
// plus a live `compaction/start` { turn: null } (no sourceCommandId, no
// summary) must render `Compacting context…` immediately. seedSession
// requires a terminal turn/end, and a live standalone start cannot sit
// inside that closed turn, so the start is appended after attach.
import { fileURLToPath } from 'node:url'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { CompactionId } from '@deepseek-ai/dsh-compaction'
import { createMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { SESSION_FORMAT_VERSION, Session, SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-title'
import {
  assertFixtureInventory, captureStableAria, compareOrRefreshGolden,
  launchWebScaffold, seedSession, watchConsole, webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/standalone-compaction-running', import.meta.url))
const UI_EXPECTED = fileURLToPath(new URL('./snapshots/standalone-compaction-running/ui.expected.md', import.meta.url))
const MODE = webSnapshotMode()
const SEED_ID = 'standalone-compaction-running-web-e2e'
const PROMPT = 'Plan a small change and stop.'
const REPLY = 'PLAN_DONE'

/** Closed one-turn seed with no compaction events. */
function closedTurnFixture(): string {
  const session = Session.create(SessionId('standalone-compaction-running-source'))
  const eventTimeOrigin = new Date().setHours(12, 0, 0, 0)
  session.append('turn/start', { turn: 1 })
  const user = session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: PROMPT }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
  session.append('session/title', {
    title: 'Standalone compaction running',
    messageSeqs: [user.seq],
    source: { kind: 'fallback' },
  })
  session.append('step/start', { turn: 1, step: 1 })
  session.append('assistant/message', {
    turn: 1,
    step: 1,
    message: createMessage({
      role: 'assistant',
      content: [{ type: 'text', text: REPLY }],
      source: { kind: 'model', provider: 'fixture', model: 'fixture' },
    }),
  }, { surfaceOp: 'append' })
  session.append('step/end', { turn: 1, step: 1 })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

  return [
    JSON.stringify({
      type: 'session',
      version: SESSION_FORMAT_VERSION,
      id: '{{sessionId}}',
      createdAt: eventTimeOrigin,
    }),
    ...session.events.map(event => JSON.stringify({
      ...event,
      time: eventTimeOrigin + event.seq,
    })),
    '',
  ].join('\n')
}

describe('web e2e: standalone compactNow shows Compacting context…', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    if (MODE === 'record') throw new Error('standalone-compaction-running is a keyless assembled snapshot')
    scaffold = await launchWebScaffold({})
    await seedSession(scaffold, closedTurnFixture(), SEED_ID)
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('renders Compacting context… from a live standalone compaction/start', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-standalone-compaction-running'))
    const groupRow = page.locator('[role="treeitem"]').first()
    await groupRow.waitFor({ timeout: 15_000 })
    await groupRow.click()
    const sessionRow = page.locator('[role="treeitem"]').nth(1)
    await sessionRow.waitFor({ timeout: 10_000 })
    await sessionRow.click()
    await expect.poll(() => page.getByText(REPLY, { exact: true }).count(), { timeout: 15_000 }).toBe(1)

    const agent = scaffold.ctx.agents.get(SessionId(SEED_ID))
    if (agent === undefined) throw new Error('seeded session did not attach an agent')
    agent.session.append('compaction/start', {
      compactionId: CompactionId('standalone-running-web-e2e'),
      turn: null,
    })

    await expect.poll(() => page.getByText('Compacting context…', { exact: true }).count(), {
      timeout: 10_000,
    }).toBe(1)
    expect(await page.getByText('Context compacted', { exact: true }).count()).toBe(0)

    const snapshot = (await captureStableAria(page, '[class*="centerCol"]', scaffold.workspaceCwd))
      .split(SEED_ID).join('{{seededId}}')
    await compareOrRefreshGolden(UI_EXPECTED, snapshot, MODE)
  }, 60_000)

  it('issued zero model calls and stayed clean', async () => {
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
    await assertFixtureInventory(SNAPSHOT_DIR, ['ui.expected.md'])
  })
})
