// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { CodegraphIndexStatus, CodegraphSettings } from '@deepseek-ai/dsh-codegraph-index/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { CodegraphSection } from '../src/client/CodegraphSection.tsx'
import { zh } from '../src/client/locales.ts'

const t = makeTranslate(zh, commonZh)
const SID = 's1' as SessionId

afterEach(cleanup)

function settingsSnap(over: Partial<SettingsScopeSnapshot<CodegraphSettings>> = {}): SettingsScopeSnapshot<CodegraphSettings> {
  return {
    status: 'ready',
    value: { autoInit: false },
    base: undefined,
    user: undefined,
    revision: 1,
    writable: true,
    mode: 'host',
    ...over,
  }
}

function renderSection(options: {
  cwd?: string
  autoInit?: boolean
  status?: CodegraphIndexStatus
} = {}) {
  const setAutoInit = vi.fn()
  const init = vi.fn(async () => ({
    ok: true as const,
    value: options.status ?? { projectPath: '/repo', indexed: false, indexing: true },
  }))
  const status = vi.fn(async () => ({
    ok: true as const,
    value: options.status ?? { projectPath: '/repo', indexed: false, indexing: false },
  }))
  render(
    <CodegraphSection
      close={() => {}}
      useWorkspaces={selector => selector({} as never)}
      useSessions={selector => selector({
        ids: [SID],
        byId: {
          [SID]: {
            id: SID, displayTitle: 'repo', cwd: options.cwd ?? '/repo',
            running: false, blank: true, updatedAt: 1,
          },
        },
        current: SID,
        phase: 'ready',
        subagentsByParent: {},
        jobsBySession: {},
        currentAddress: undefined,
      })}
      t={t}
      setAutoInit={setAutoInit}
      status={status}
      init={init}
      useCodegraphSettings={selector => selector(settingsSnap({
        value: { autoInit: options.autoInit === true },
      }))}
    />,
  )
  return { setAutoInit, init, status }
}

describe('CodegraphSection', () => {
  it('writes the auto-init switch and can start init', async () => {
    const { setAutoInit, init } = renderSection()
    expect(screen.getByText('代码索引')).toBeTruthy()
    fireEvent.click(screen.getByRole('switch'))
    expect(setAutoInit).toHaveBeenCalledWith(true)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '立即初始化' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '立即初始化' }))
    expect(init).toHaveBeenCalledWith(SID)
  })

  it('shows the empty-workspace copy when the current session has no cwd', () => {
    renderSection({ cwd: '' })
    expect(screen.getByText('当前会话没有工作区')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '立即初始化' })).toBeNull()
  })
})
