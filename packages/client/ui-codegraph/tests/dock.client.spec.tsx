// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { CodegraphIndexBanner } from '../src/client/CodegraphDock.tsx'
import { zh } from '../src/client/locales.ts'

const t = makeTranslate(zh, commonZh)

afterEach(cleanup)

describe('CodegraphIndexBanner', () => {
  it('renders nothing when hidden', () => {
    const { container } = render(
      <CodegraphIndexBanner mode="hidden" onInit={() => {}} onDismiss={() => {}} t={t} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows initialize and dismiss on a blank unindexed workspace', () => {
    const onInit = vi.fn()
    const onDismiss = vi.fn()
    render(<CodegraphIndexBanner mode="choice" onInit={onInit} onDismiss={onDismiss} t={t} />)
    expect(screen.getByText('当前工作区还没有代码索引')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '初始化' }))
    fireEvent.click(screen.getByRole('button', { name: '忽略' }))
    expect(onInit).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('shows progress while indexing', () => {
    render(<CodegraphIndexBanner mode="progress" onInit={() => {}} onDismiss={() => {}} t={t} />)
    expect(screen.getByText('正在建立代码索引…')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '初始化' })).toBeNull()
  })

  it('shows a retryable failure', () => {
    const onInit = vi.fn()
    render(
      <CodegraphIndexBanner mode="error" error="index failed" onInit={onInit} onDismiss={() => {}} t={t} />,
    )
    expect(screen.getByRole('alert').textContent).toBe('index failed')
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(onInit).toHaveBeenCalledTimes(1)
  })
})
