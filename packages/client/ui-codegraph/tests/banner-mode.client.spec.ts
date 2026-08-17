import { describe, expect, it } from 'vitest'
import { codegraphBannerMode } from '../src/client/banner-mode.ts'
import type { CodegraphIndexStatus } from '@deepseek-ai/dsh-codegraph-index/client'

const missing: CodegraphIndexStatus = {
  projectPath: '/repo',
  indexed: false,
  indexing: false,
}

describe('codegraphBannerMode', () => {
  it('hides when the session is not blank, has no cwd, or is dismissed', () => {
    expect(codegraphBannerMode({
      blank: false, cwd: '/repo', dismissed: false, autoInit: false, status: missing,
    })).toBe('hidden')
    expect(codegraphBannerMode({
      blank: true, cwd: undefined, dismissed: false, autoInit: false, status: missing,
    })).toBe('hidden')
    expect(codegraphBannerMode({
      blank: true, cwd: '/repo', dismissed: true, autoInit: false, status: missing,
    })).toBe('hidden')
  })

  it('hides until the first status arrives and after the workspace is indexed', () => {
    expect(codegraphBannerMode({
      blank: true, cwd: '/repo', dismissed: false, autoInit: false, status: undefined,
    })).toBe('hidden')
    expect(codegraphBannerMode({
      blank: true, cwd: '/repo', dismissed: false, autoInit: false,
      status: { ...missing, indexed: true },
    })).toBe('hidden')
  })

  it('shows the two actions on a blank unindexed workspace', () => {
    expect(codegraphBannerMode({
      blank: true, cwd: '/repo', dismissed: false, autoInit: false, status: missing,
    })).toBe('choice')
  })

  it('shows progress while indexing or when auto-init is on', () => {
    expect(codegraphBannerMode({
      blank: true, cwd: '/repo', dismissed: false, autoInit: false,
      status: { ...missing, indexing: true },
    })).toBe('progress')
    expect(codegraphBannerMode({
      blank: true, cwd: '/repo', dismissed: false, autoInit: true, status: missing,
    })).toBe('progress')
  })

  it('shows a retryable error after a failed init', () => {
    expect(codegraphBannerMode({
      blank: true, cwd: '/repo', dismissed: false, autoInit: false,
      status: { ...missing, error: 'index failed' },
    })).toBe('error')
  })
})
