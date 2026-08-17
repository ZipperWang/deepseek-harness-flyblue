import { describe, expect, it, vi } from 'vitest'
import {
  buildCliArgv,
  createInProcessDriver,
  createSubprocessDriver,
  ENGINE_UNAVAILABLE_TEXT,
  looksUnindexed,
  nodeMajor,
  notIndexedText,
  resolveIsolation,
  UNSAFE_NODE_MAJOR,
} from '@deepseek-ai/dsh-tool-codegraph'
import type { CodegraphBindings, OpenedCodegraph } from '@deepseek-ai/dsh-tool-codegraph'

const signal = new AbortController().signal

describe('resolveIsolation', () => {
  it('keeps explicit modes and maps auto at the Node 25 boundary', () => {
    expect(resolveIsolation('in-process', 25)).toBe('in-process')
    expect(resolveIsolation('subprocess', 22)).toBe('subprocess')
    expect(resolveIsolation('auto', UNSAFE_NODE_MAJOR - 1)).toBe('in-process')
    expect(resolveIsolation('auto', UNSAFE_NODE_MAJOR)).toBe('subprocess')
  })

  it('reads the running Node major and treats a missing major as 0', () => {
    expect(nodeMajor()).toBe(Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10))
    expect(nodeMajor('22.19.0')).toBe(22)
    expect(nodeMajor('')).toBe(0)
  })
})

describe('buildCliArgv', () => {
  it('maps every extra tool onto the vendored CLI', () => {
    const projectPath = '/repo'
    expect(buildCliArgv('codegraph_explore', { projectPath, query: 'Auth login', maxFiles: 4 }))
      .toEqual(['explore', '--path', projectPath, '--max-files', '4', 'Auth login'])
    expect(buildCliArgv('codegraph_explore', { projectPath, query: 'Auth' }))
      .toEqual(['explore', '--path', projectPath, 'Auth'])
    expect(buildCliArgv('codegraph_status', { projectPath })).toEqual(['status', projectPath])
    expect(buildCliArgv('codegraph_search', { projectPath, query: 'open', limit: 5, kind: 'function' }))
      .toEqual(['query', 'open', '--path', projectPath, '--limit', '5', '--kind', 'function'])
    expect(buildCliArgv('codegraph_search', { projectPath, query: 'open' }))
      .toEqual(['query', 'open', '--path', projectPath])
    expect(buildCliArgv('codegraph_node', { projectPath, symbol: 'open', file: 'a.ts', offset: 1, limit: 20 }))
      .toEqual(['node', 'open', '--path', projectPath, '--file', 'a.ts', '--offset', '1', '--limit', '20'])
    expect(buildCliArgv('codegraph_node', { projectPath })).toEqual(['node', '--path', projectPath])
    expect(buildCliArgv('codegraph_callers', { projectPath, symbol: 'open', limit: 3 }))
      .toEqual(['callers', 'open', '--path', projectPath, '--limit', '3'])
    expect(buildCliArgv('codegraph_callers', { projectPath, symbol: 'open' }))
      .toEqual(['callers', 'open', '--path', projectPath])
    expect(buildCliArgv('codegraph_callees', { projectPath, symbol: 'open', limit: 4 }))
      .toEqual(['callees', 'open', '--path', projectPath, '--limit', '4'])
    expect(buildCliArgv('codegraph_callees', { projectPath, symbol: 'open' }))
      .toEqual(['callees', 'open', '--path', projectPath])
    expect(buildCliArgv('codegraph_impact', { projectPath, symbol: 'open', depth: 2 }))
      .toEqual(['impact', 'open', '--path', projectPath, '--depth', '2'])
    expect(buildCliArgv('codegraph_impact', { projectPath, symbol: 'open' }))
      .toEqual(['impact', 'open', '--path', projectPath])
    expect(buildCliArgv('codegraph_files', { projectPath, path: 'src', pattern: '*.ts', format: 'flat', maxDepth: 2 }))
      .toEqual(['files', '--path', projectPath, '--filter', 'src', '--pattern', '*.ts', '--format', 'flat', '--max-depth', '2'])
    expect(buildCliArgv('codegraph_files', { projectPath })).toEqual(['files', '--path', projectPath])
    expect(buildCliArgv('codegraph_unknown', { projectPath })).toEqual(['codegraph_unknown', '--path', projectPath])
  })
})

describe('looksUnindexed', () => {
  it('recognizes the engine and CLI missing-index banners', () => {
    expect(looksUnindexed(notIndexedText('/repo'))).toBe(true)
    expect(looksUnindexed('CodeGraph not initialized in /repo')).toBe(true)
    expect(looksUnindexed('found 3 symbols')).toBe(false)
  })
})

describe('createInProcessDriver', () => {
  it('returns guidance when the engine fails to load', async () => {
    const driver = createInProcessDriver(() => {
      throw new Error('missing')
    })
    await expect(driver.execute('codegraph_explore', { projectPath: '/repo', query: 'x' }, signal))
      .resolves.toEqual({ text: ENGINE_UNAVAILABLE_TEXT, isError: false, indexed: false })
  })

  it('returns not-indexed guidance without opening a graph', async () => {
    const open = vi.fn()
    const driver = createInProcessDriver(() => ({
      isInitialized: () => false,
      open,
    }))
    await expect(driver.execute('codegraph_explore', { projectPath: '/repo', query: 'x' }, signal))
      .resolves.toEqual({ text: notIndexedText('/repo'), isError: false, indexed: false })
    expect(open).not.toHaveBeenCalled()
  })

  it('caches one opened graph per project and closes on dispose', async () => {
    const close = vi.fn()
    const execute = vi.fn(async () => ({ text: 'body', isError: false, indexed: true }))
    const open = vi.fn(async (): Promise<OpenedCodegraph> => ({ execute, close }))
    const bindings: CodegraphBindings = { isInitialized: () => true, open }
    const driver = createInProcessDriver(() => bindings)
    const args = { projectPath: '/repo', query: 'x' }
    await expect(driver.execute('codegraph_explore', args, signal)).resolves.toEqual({
      text: 'body', isError: false, indexed: true,
    })
    await driver.execute('codegraph_explore', args, signal)
    expect(open).toHaveBeenCalledOnce()
    driver.dispose()
    expect(close).toHaveBeenCalledOnce()
  })
})

describe('createSubprocessDriver', () => {
  it('treats a zero exit as indexed output', async () => {
    const run = vi.fn(async () => ({ stdout: 'source', stderr: '', code: 0 }))
    const driver = createSubprocessDriver({ run })
    await expect(driver.execute('codegraph_explore', { projectPath: '/repo', query: 'x' }, signal))
      .resolves.toEqual({ text: 'source', isError: false, indexed: true })
    expect(run).toHaveBeenCalledWith(['explore', '--path', '/repo', 'x'], { signal })
  })

  it('treats a missing-index CLI failure as success-shaped guidance', async () => {
    const driver = createSubprocessDriver({
      run: async () => ({ stdout: '', stderr: 'CodeGraph not initialized in /repo', code: 1 }),
    })
    await expect(driver.execute('codegraph_explore', { projectPath: '/repo', query: 'x' }, signal))
      .resolves.toMatchObject({ isError: false, indexed: false })
  })

  it('returns engine-unavailable guidance when spawn fails, and rethrows abort', async () => {
    const driver = createSubprocessDriver({
      run: async () => {
        throw new Error('ENOENT')
      },
    })
    await expect(driver.execute('codegraph_explore', { projectPath: '/repo', query: 'x' }, signal))
      .resolves.toEqual({ text: ENGINE_UNAVAILABLE_TEXT, isError: false, indexed: false })

    const aborting = createSubprocessDriver({
      run: async () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        throw error
      },
    })
    await expect(aborting.execute('codegraph_explore', { projectPath: '/repo', query: 'x' }, signal))
      .rejects.toMatchObject({ name: 'AbortError' })
    aborting.dispose()
  })

  it('joins stdout/stderr and uses the not-indexed banner when both are empty', async () => {
    const emptyFail = createSubprocessDriver({
      run: async () => ({ stdout: '', stderr: '', code: 1 }),
    })
    await expect(emptyFail.execute('codegraph_status', { projectPath: '/repo' }, signal))
      .resolves.toEqual({ text: notIndexedText('/repo'), isError: false, indexed: false })

    const mixed = createSubprocessDriver({
      run: async () => ({ stdout: 'out', stderr: 'err', code: 0 }),
    })
    await expect(mixed.execute('codegraph_status', { projectPath: '/repo' }, signal))
      .resolves.toEqual({ text: 'out\nerr', isError: false, indexed: true })
  })
})
