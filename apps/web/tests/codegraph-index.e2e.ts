// Web e2e: blank-session CodeGraph index prompt and the「代码索引」settings page.
// Zero model calls: status/init are host RPCs over the real web composition.
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  assertFixtureInventory, captureStableAria, compareOrRefreshGolden,
  launchWebScaffold, watchConsole, webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { ZH_BROWSER_LOCALE, saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/codegraph-index', import.meta.url))
const DOCK_EXPECTED = join(SNAPSHOT_DIR, 'dock.expected.md')
const SECTION_EXPECTED = join(SNAPSHOT_DIR, 'section.expected.md')
const MODE = webSnapshotMode()

describe('web e2e: CodeGraph index prompt and settings', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({})
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: ZH_BROWSER_LOCALE })
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('shows initialize/dismiss on a blank unindexed workspace, then the settings page', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-codegraph-index'))
    const dock = page.locator('[data-codegraph-index]')
    await dock.waitFor({ timeout: 15_000 })
    await expect.poll(() => dock.getByRole('button', { name: '初始化' }).count(), { timeout: 10_000 }).toBe(1)
    const dockSnapshot = await captureStableAria(page, '[data-codegraph-index]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(DOCK_EXPECTED, dockSnapshot, MODE)

    await dock.getByRole('button', { name: '忽略' }).click()
    await expect.poll(() => page.locator('[data-codegraph-index]').count(), { timeout: 5_000 }).toBe(0)

    await page.getByRole('button', { name: '设置', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '设置' })
    await dialog.waitFor({ timeout: 10_000 })
    await dialog.getByRole('button', { name: '代码索引' }).click()
    await dialog.getByRole('heading', { name: '代码索引' }).waitFor({ timeout: 10_000 })
    await dialog.getByRole('switch', { name: '自动初始化未索引的工作区' }).waitFor({ timeout: 10_000 })
    const sectionSnapshot = await captureStableAria(page, '[role="dialog"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(SECTION_EXPECTED, sectionSnapshot, MODE)
    expect(tripwire.pageErrors).toEqual([])
    await assertFixtureInventory(SNAPSHOT_DIR, ['dock.expected.md', 'section.expected.md'])
  }, 60_000)
})
