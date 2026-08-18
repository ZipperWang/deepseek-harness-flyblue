// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-connection/client'
import type { WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import {
  breadcrumbSegments, formatBytes, SEARCH_DEBOUNCE_MS, WorkspaceInspectorSection,
} from '../src/client/section.tsx'
import type { WorkspaceInspectorInjected } from '../src/client/section.tsx'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
const t = (key: string) => key
const okValue = <T,>(value: T): RemoteResult<T> => ({ ok: true, value })
const failValue = (message: string): RemoteResult<never> => ({ ok: false, error: { code: 'Error', message, details: {} } })
const file = (path: string, name: string, size = 12) => ({ path, name, directory: false, size })
const dir = (path: string, name: string) => ({ path, name, directory: true, size: 0 })
const workspaceState = (path: string | undefined): WorkspaceListState => ({
  items: path === undefined ? [] : [{ workspaceId: 'ws-1' as WorkspaceId, path, title: 'proj', sessionIds: [], createdAt: '2026-08-01', updatedAt: '2026-08-01' }],
  archivedSessionIds: [], state: 'idle', phase: 'ready', error: null, baselinesReady: true, recentWorkspaceId: path === undefined ? undefined : 'ws-1' as WorkspaceId,
})
const useWorkspaces: SnapshotSelectorHook<WorkspaceListState> = selector => selector(workspaceState('/work/proj'))
const rootEntries = [dir('src', 'src'), file('README.md', 'README.md', 2400)]

interface Verbs {
  tree?: WorkspaceInspectorInjected['tree']
  preview?: WorkspaceInspectorInjected['preview']
  search?: WorkspaceInspectorInjected['search']
  workspaceId?: () => string | undefined
}

function renderSection(verbs: Verbs = {}) {
  const resolved: WorkspaceInspectorInjected = {
    tree: verbs.tree ?? (async (_id, path) => okValue(path === '' ? rootEntries : [file('src/a.ts', 'a.ts', 80)])),
    preview: verbs.preview ?? (async () => okValue({ path: 'README.md', content: '# Hello', truncated: false, version: '1:12' })),
    search: verbs.search ?? (async () => okValue([file('README.md', 'README.md')])),
    workspaceId: verbs.workspaceId ?? (() => 'ws-1'),
  }
  render(
    <WorkspaceInspectorSection
      t={t as never}
      close={() => {}}
      useSessions={(() => undefined) as never}
      useWorkspaces={useWorkspaces}
      {...resolved}
    />,
  )
  return resolved
}

describe('formatBytes', () => {
  it('formats B, KB, and MB buckets', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
  })
})

describe('breadcrumbSegments', () => {
  it('splits a relative path and treats the root as empty', () => {
    expect(breadcrumbSegments('')).toEqual([])
    expect(breadcrumbSegments('src/client/index.ts')).toEqual(['src', 'client', 'index.ts'])
  })
})

describe('WorkspaceInspectorSection', () => {
  beforeEach(() => { vi.useRealTimers() })

  it('shows a skeleton, then the root listing and workspace path', async () => {
    let resolveTree!: (value: RemoteResult<typeof rootEntries>) => void
    const tree = vi.fn<WorkspaceInspectorInjected['tree']>(() => new Promise((done) => { resolveTree = done }))
    renderSection({ tree })
    expect(screen.getByLabelText('loading')).toBeTruthy()
    resolveTree(okValue(rootEntries))
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(screen.getByText('src')).toBeTruthy()
    expect(screen.getByText(/workspace · \/work\/proj/)).toBeTruthy()
    expect(screen.getByText('2.3 KB')).toBeTruthy()
    expect(screen.getByText('previewHint')).toBeTruthy()
  })

  it('shows an empty state when no workspace is registered', async () => {
    const tree = vi.fn<WorkspaceInspectorInjected['tree']>(async () => okValue([]))
    renderSection({ workspaceId: () => undefined, tree })
    await waitFor(() => { expect(screen.getByText('noWorkspace')).toBeTruthy() })
    expect(tree).not.toHaveBeenCalled()
  })

  it('navigates into a nested directory and back through an intermediate crumb', async () => {
    const tree = vi.fn<WorkspaceInspectorInjected['tree']>()
      .mockResolvedValueOnce(okValue(rootEntries))
      .mockResolvedValueOnce(okValue([dir('src/client', 'client')]))
      .mockResolvedValueOnce(okValue([file('src/client/index.ts', 'index.ts')]))
      .mockResolvedValueOnce(okValue([dir('src/client', 'client')]))
    renderSection({ tree })
    await screen.findByText('README.md')
    fireEvent.click(screen.getByRole('button', { name: /src/ }))
    await screen.findByText('client')
    fireEvent.click(screen.getByRole('button', { name: /client/ }))
    await waitFor(() => { expect(screen.getByText('index.ts')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'src' }))
    await waitFor(() => { expect(tree).toHaveBeenLastCalledWith('ws-1', 'src') })
  })

  it('navigates into a directory and back through the breadcrumb', async () => {
    const tree = vi.fn<WorkspaceInspectorInjected['tree']>()
      .mockResolvedValueOnce(okValue(rootEntries))
      .mockResolvedValueOnce(okValue([file('src/a.ts', 'a.ts', 80)]))
      .mockResolvedValueOnce(okValue(rootEntries))
    renderSection({ tree })
    await screen.findByText('README.md')
    fireEvent.click(screen.getByRole('button', { name: /src/ }))
    await waitFor(() => { expect(screen.getByText('a.ts')).toBeTruthy() })
    expect(tree).toHaveBeenLastCalledWith('ws-1', 'src')
    fireEvent.click(screen.getByRole('button', { name: 'root' }))
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
    expect(tree).toHaveBeenLastCalledWith('ws-1', '')
  })

  it('previews a file and reports a truncated banner', async () => {
    const preview = vi.fn<WorkspaceInspectorInjected['preview']>(async () => okValue({
      path: 'README.md', content: '# Hello', truncated: true, version: '9:12',
    }))
    renderSection({ preview })
    await screen.findByText('README.md')
    fireEvent.click(screen.getByRole('button', { name: /README.md/ }))
    await waitFor(() => { expect(screen.getByText('# Hello')).toBeTruthy() })
    expect(preview).toHaveBeenCalledWith('ws-1', 'README.md')
    expect(screen.getByText('truncated')).toBeTruthy()
    expect(screen.getByText(/version · 9:12/)).toBeTruthy()
  })

  it('searches after a debounce and opens a matching file', async () => {
    const search = vi.fn<WorkspaceInspectorInjected['search']>(async () => okValue([file('docs/guide.md', 'guide.md')]))
    const preview = vi.fn<WorkspaceInspectorInjected['preview']>(async () => okValue({
      path: 'docs/guide.md', content: 'guide', truncated: false,
    }))
    renderSection({ search, preview })
    await screen.findByText('README.md')
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('searchAria'), { target: { value: 'guide' } })
    expect(search).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    vi.useRealTimers()
    await waitFor(() => { expect(search).toHaveBeenCalledWith('ws-1', 'guide') })
    await screen.findByText('guide.md')
    fireEvent.click(screen.getByRole('button', { name: /guide.md/ }))
    await waitFor(() => { expect(preview).toHaveBeenCalledWith('ws-1', 'docs/guide.md') })
    expect(screen.getByText('guide')).toBeTruthy()
  })

  it('opens a search hit directory and clears the query', async () => {
    const search = vi.fn<WorkspaceInspectorInjected['search']>(async () => okValue([dir('src/client', 'client')]))
    const tree = vi.fn<WorkspaceInspectorInjected['tree']>()
      .mockResolvedValueOnce(okValue(rootEntries))
      .mockResolvedValueOnce(okValue([file('src/client/index.ts', 'index.ts')]))
    renderSection({ search, tree })
    await screen.findByText('README.md')
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('searchAria'), { target: { value: 'client' } })
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    vi.useRealTimers()
    await screen.findByText('client')
    fireEvent.click(screen.getByRole('button', { name: /client/ }))
    await waitFor(() => { expect(tree).toHaveBeenLastCalledWith('ws-1', 'src/client') })
    const searchBox = screen.getByLabelText('searchAria')
    expect(searchBox instanceof HTMLInputElement && searchBox.value === '').toBe(true)
    await waitFor(() => { expect(screen.getByText('index.ts')).toBeTruthy() })
  })

  it('reports a search failure after the debounce', async () => {
    const search = vi.fn<WorkspaceInspectorInjected['search']>(async () => failValue('scan limit'))
    renderSection({ search })
    await screen.findByText('README.md')
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('searchAria'), { target: { value: 'zz' } })
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    vi.useRealTimers()
    await waitFor(() => { expect(screen.getByText(/scan limit/)).toBeTruthy() })
  })

  it('shows the empty search copy', async () => {
    const search = vi.fn<WorkspaceInspectorInjected['search']>(async () => okValue([]))
    renderSection({ search })
    await screen.findByText('README.md')
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('searchAria'), { target: { value: 'none' } })
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    vi.useRealTimers()
    await waitFor(() => { expect(screen.getByText('searchEmpty')).toBeTruthy() })
  })

  it('drops a search response after the query changes mid-flight', async () => {
    let resolveSearch!: (value: RemoteResult<ReturnType<typeof file>[]>) => void
    const search = vi.fn<WorkspaceInspectorInjected['search']>(() => new Promise((done) => { resolveSearch = done }))
    renderSection({ search })
    await screen.findByText('README.md')
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('searchAria'), { target: { value: 'one' } })
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    fireEvent.change(screen.getByLabelText('searchAria'), { target: { value: 'two' } })
    vi.useRealTimers()
    resolveSearch(okValue([file('one.ts', 'one.ts')]))
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(screen.queryByText('one.ts')).toBeNull()
  })

  it('drops a stale preview after a newer tree load', async () => {
    let resolvePreview!: (value: RemoteResult<{ path: string; content: string; truncated: boolean }>) => void
    const preview = vi.fn<WorkspaceInspectorInjected['preview']>(() => new Promise((done) => { resolvePreview = done }))
    renderSection({ preview })
    await screen.findByText('README.md')
    fireEvent.click(screen.getByRole('button', { name: /README.md/ }))
    fireEvent.click(screen.getByRole('button', { name: /src/ }))
    await waitFor(() => { expect(screen.getByText('a.ts')).toBeTruthy() })
    resolvePreview(okValue({ path: 'README.md', content: 'stale preview', truncated: false }))
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(screen.queryByText('stale preview')).toBeNull()
  })

  it('cancels a pending search when the query is cleared', async () => {
    const search = vi.fn<WorkspaceInspectorInjected['search']>(async () => okValue([file('hit.ts', 'hit.ts')]))
    renderSection({ search })
    await screen.findByText('README.md')
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('searchAria'), { target: { value: 'hit' } })
    fireEvent.change(screen.getByLabelText('searchAria'), { target: { value: '' } })
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    vi.useRealTimers()
    expect(search).not.toHaveBeenCalled()
  })

  it('renders the error banner and recovers through retry', async () => {
    const tree = vi.fn<WorkspaceInspectorInjected['tree']>()
      .mockResolvedValueOnce(failValue('workspace missing'))
      .mockResolvedValueOnce(okValue(rootEntries))
    renderSection({ tree })
    await waitFor(() => { expect(screen.getByText(/workspace missing/)).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => { expect(screen.getByText('README.md')).toBeTruthy() })
  })

  it('reports a preview failure without leaving the listing', async () => {
    const preview = vi.fn<WorkspaceInspectorInjected['preview']>(async () => failValue('cannot preview a directory'))
    renderSection({ preview })
    await screen.findByText('README.md')
    fireEvent.click(screen.getByRole('button', { name: /README.md/ }))
    await waitFor(() => { expect(screen.getByText(/cannot preview a directory/)).toBeTruthy() })
    expect(screen.getByText('README.md')).toBeTruthy()
  })

  it('shows the empty listing copy for an empty directory', async () => {
    renderSection({ tree: async () => okValue([]) })
    await waitFor(() => { expect(screen.getByText('treeEmpty')).toBeTruthy() })
  })

  it('ignores a stale tree response after a newer navigation', async () => {
    const pending: Array<(value: RemoteResult<typeof rootEntries>) => void> = []
    let calls = 0
    const tree = vi.fn<WorkspaceInspectorInjected['tree']>(() => {
      calls += 1
      if (calls === 1) return Promise.resolve(okValue(rootEntries))
      return new Promise((done) => { pending.push(done) })
    })
    renderSection({ tree })
    await screen.findByText('src')
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
    await waitFor(() => { expect(calls).toBe(2) })
    fireEvent.click(screen.getByRole('button', { name: /src/ }))
    await waitFor(() => { expect(calls).toBe(3) })
    pending[1]?.(okValue([file('src/a.ts', 'a.ts')]))
    await waitFor(() => { expect(screen.getByText('a.ts')).toBeTruthy() })
    pending[0]?.(okValue([file('stale.md', 'stale.md')]))
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(screen.queryByText('stale.md')).toBeNull()
    expect(screen.getByText('a.ts')).toBeTruthy()
  })
})
