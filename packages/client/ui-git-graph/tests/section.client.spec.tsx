// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-connection/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { assignLanes, GitGraphSection, statusMeta } from '../src/client/section.tsx'
import type { GitGraphInjected } from '../src/client/section.tsx'

afterEach(cleanup)
const t = (key: string) => key
const okValue = <T,>(value: T): RemoteResult<T> => ({ ok: true, value })
const failValue = (message: string): RemoteResult<never> => ({ ok: false, error: { code: 'Error', message, details: {} } })
const commit = (hash: string, parents: string[], subject = `subject-${hash}`, refs: string[] = []) => ({ hash, parents, subject, refs })
const workspaceState = (path: string | undefined): WorkspaceListState => ({
  items: path === undefined ? [] : [{ workspaceId: 'ws-1' as WorkspaceId, path, title: 'proj', sessionIds: [], createdAt: '2026-08-01', updatedAt: '2026-08-01' }],
  archivedSessionIds: [], state: 'idle', phase: 'ready', error: null, baselinesReady: true, recentWorkspaceId: path === undefined ? undefined : 'ws-1' as WorkspaceId,
})
const useWorkspaces: SnapshotSelectorHook<WorkspaceListState> = selector => selector(workspaceState('/work/proj'))

interface Verbs { graph?: GitGraphInjected['graph']; status?: GitGraphInjected['status']; branches?: GitGraphInjected['branches']; createBranch?: GitGraphInjected['createBranch']; switchBranch?: GitGraphInjected['switchBranch']; stage?: GitGraphInjected['stage']; unstage?: GitGraphInjected['unstage']; discard?: GitGraphInjected['discard']; workspaceId?: () => string | undefined }

function renderSection(verbs: Verbs = {}) {
  const resolved: GitGraphInjected = {
    graph: verbs.graph ?? (async () => okValue([commit('aaa111', ['bbb222']), commit('bbb222', [])])),
    status: verbs.status ?? (async () => okValue([])),
    branches: verbs.branches ?? (async () => okValue({ current: 'main', branches: ['main', 'dev'] })),
    createBranch: verbs.createBranch ?? (async () => okValue(undefined)),
    switchBranch: verbs.switchBranch ?? (async () => okValue(undefined)),
    stage: verbs.stage ?? (async () => okValue(undefined)),
    unstage: verbs.unstage ?? (async () => okValue(undefined)),
    discard: verbs.discard ?? (async () => okValue(undefined)),
    workspaceId: verbs.workspaceId ?? (() => 'ws-1'),
  }
  render(
    <GitGraphSection
      t={t as never}
      close={() => {}}
      useSessions={(() => undefined) as never}
      useWorkspaces={useWorkspaces}
      {...resolved}
    />,
  )
  return resolved
}

describe('statusMeta', () => {
  it('classifies porcelain pairs into kinds and action flags', () => {
    expect(statusMeta('M', ' ')).toEqual({ kind: 'staged', staged: true, worktree: false })
    expect(statusMeta(' ', 'M')).toEqual({ kind: 'unstaged', staged: false, worktree: true })
    expect(statusMeta('M', 'M')).toEqual({ kind: 'staged', staged: true, worktree: true })
    expect(statusMeta('?', '?')).toEqual({ kind: 'untracked', staged: false, worktree: true })
    expect(statusMeta('U', 'U')).toEqual({ kind: 'conflict', staged: false, worktree: false })
    expect(statusMeta('D', 'U')).toEqual({ kind: 'conflict', staged: false, worktree: false })
    expect(statusMeta(' ', ' ')).toEqual({ kind: 'unstaged', staged: false, worktree: false })
  })
})

describe('assignLanes', () => {
  it('keeps a linear history on one lane', () => {
    const lanes = assignLanes([commit('a', ['b']), commit('b', ['c']), commit('c', [])])
    expect(lanes).toEqual([{ lane: 0, lines: [0] }, { lane: 0, lines: [0] }, { lane: 0, lines: [] }])
  })

  it('opens a second lane for a merge and keeps both trunks visible above the merge', () => {
    const lanes = assignLanes([
      commit('a', ['b', 'c']),
      commit('b', ['d']),
      commit('c', ['e']),
      commit('d', []),
      commit('e', []),
    ])
    expect(lanes).toEqual([
      { lane: 0, lines: [0, 1] },
      { lane: 0, lines: [0, 1] },
      { lane: 1, lines: [0, 1] },
      { lane: 0, lines: [1] },
      { lane: 1, lines: [] },
    ])
  })

  it('reuses a freed hole when a new independent commit opens', () => {
    const lanes = assignLanes([
      commit('a', ['b', 'c']),
      commit('b', []),
      commit('d', ['e']),
      commit('c', []),
      commit('e', []),
    ])
    expect(lanes[2]?.lane).toBe(0)
  })

  it('fills a freed middle lane with an extra merge parent', () => {
    const lanes = assignLanes([
      commit('a', ['b', 'c']),
      commit('b', []),
      commit('c', ['d', 'e']),
      commit('d', []),
      commit('e', []),
    ])
    expect(lanes[2]?.lane).toBe(1)
    expect(lanes[2]?.lines).toEqual([0, 1])
  })

  it('reuses a freed lane column and dedupes repeated parents', () => {
    const lanes = assignLanes([
      commit('a', ['b']),
      commit('b', ['c']),
      commit('c', []),
      commit('d', ['e', 'e']),
      commit('e', []),
    ])
    expect(lanes).toEqual([
      { lane: 0, lines: [0] },
      { lane: 0, lines: [0] },
      { lane: 0, lines: [] },
      { lane: 0, lines: [0] },
      { lane: 0, lines: [] },
    ])
  })

  it('handles an empty history', () => {
    expect(assignLanes([])).toEqual([])
  })
})

describe('GitGraphSection', () => {
  it('shows a skeleton, then changes, branches, and the commit graph', async () => {
    let resolveGraph!: (value: Awaited<ReturnType<GitGraphInjected['graph']>>) => void
    const graph = vi.fn<GitGraphInjected['graph']>(() => new Promise((done) => { resolveGraph = done }))
    const status = vi.fn<GitGraphInjected['status']>(async () => okValue([
      { path: 'a.ts', index: 'M', worktree: ' ' },
      { path: 'b.ts', index: ' ', worktree: 'M' },
      { path: 'new.md', index: '?', worktree: '?' },
      { path: 'conf.ts', index: 'U', worktree: 'U' },
    ]))
    renderSection({ graph, status })
    expect(screen.getByLabelText('loading')).toBeTruthy()
    resolveGraph(okValue([commit('aaa111', ['bbb222'], 'feat: lanes', ['HEAD -> main', 'origin/main'])]))
    await waitFor(() => { expect(screen.getByText('feat: lanes')).toBeTruthy() })
    const section = screen.getByText('title').closest('section')!
    expect(section.getAttribute('data-git-graph')).toBe('true')
    expect(section.getAttribute('aria-busy')).toBe('false')
    // Workspace chip + status kinds + branch list + graph rows.
    expect(screen.getByText(/workspace · \/work\/proj/)).toBeTruthy()
    expect(screen.getByText('staged')).toBeTruthy()
    expect(screen.getByText('unstaged')).toBeTruthy()
    expect(screen.getByText('untracked')).toBeTruthy()
    expect(screen.getByText('conflict')).toBeTruthy()
    expect(screen.getByText('currentBranch')).toBeTruthy()
    expect(screen.getByText('dev')).toBeTruthy()
    expect(screen.getByText('aaa111')).toBeTruthy()
    expect(screen.getByText('HEAD -> main')).toBeTruthy()
    // Conflict rows offer no mutation buttons; staged rows unstage; worktree rows stage+discard.
    expect(screen.queryByRole('button', { name: 'unstage' })).toBeTruthy()
    expect(screen.queryAllByRole('button', { name: 'stage' })).toHaveLength(2)
    expect(screen.queryAllByRole('button', { name: 'discard' })).toHaveLength(2)
    const conflictRow = screen.getByText('conf.ts').closest('li')!
    expect(conflictRow.querySelectorAll('button')).toHaveLength(0)
  })

  it('shows an empty branch list', async () => {
    renderSection({
      graph: async () => okValue([]),
      branches: async () => okValue({ current: null, branches: [] }),
    })
    await waitFor(() => { expect(screen.getByText('branchesEmpty')).toBeTruthy() })
  })

  it('shows empty states for a clean repository', async () => {
    renderSection({ graph: async () => okValue([]) })
    await waitFor(() => { expect(screen.getByText('changesEmpty')).toBeTruthy() })
    expect(screen.getByText('historyEmpty')).toBeTruthy()
  })

  it('shows an empty state when no workspace is registered and skips the Remote calls', async () => {
    const graph = vi.fn<GitGraphInjected['graph']>(async () => okValue([]))
    renderSection({ workspaceId: () => undefined, graph })
    await waitFor(() => { expect(screen.getByText('noWorkspace')).toBeTruthy() })
    expect(graph).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'refresh' }).getAttribute('disabled')).not.toBeNull()
  })

  it('renders the error banner and recovers through retry', async () => {
    const graph = vi.fn<GitGraphInjected['graph']>()
      .mockResolvedValueOnce(failValue('repo missing'))
      .mockResolvedValueOnce(okValue([commit('aaa111', [])]))
    renderSection({ graph })
    await waitFor(() => { expect(screen.getByText(/repo missing/)).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => { expect(screen.getByText('subject-aaa111')).toBeTruthy() })
    expect(screen.queryByText(/repo missing/)).toBeNull()
  })

  it('reports a status facet failure', async () => {
    const status = vi.fn<GitGraphInjected['status']>(async () => failValue('status failed'))
    renderSection({ status, graph: async () => okValue([]) })
    await waitFor(() => { expect(screen.getByText(/status failed/)).toBeTruthy() })
  })

  it('keeps the last failure text when only one facet fails', async () => {
    const branches = vi.fn<GitGraphInjected['branches']>(async () => failValue('branch scan failed'))
    renderSection({ branches, graph: async () => okValue([]) })
    await waitFor(() => { expect(screen.getByText(/branch scan failed/)).toBeTruthy() })
    expect(screen.getByText('historyEmpty')).toBeTruthy()
  })

  it('stages, unstages, and discards with a two-step confirmation', async () => {
    const stage = vi.fn<GitGraphInjected['stage']>(async () => okValue(undefined))
    const unstage = vi.fn<GitGraphInjected['unstage']>(async () => okValue(undefined))
    const discard = vi.fn<GitGraphInjected['discard']>(async () => okValue(undefined))
    const status = vi.fn<GitGraphInjected['status']>(async () => okValue([
      { path: 'a.ts', index: 'M', worktree: ' ' },
      { path: 'b.ts', index: ' ', worktree: 'M' },
    ]))
    const graph = vi.fn<GitGraphInjected['graph']>(async () => okValue([]))
    renderSection({ status, graph, stage, unstage, discard })
    await waitFor(() => { expect(screen.getByText('a.ts')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'unstage' }))
    await waitFor(() => { expect(unstage).toHaveBeenCalledWith('ws-1', 'a.ts') })
    fireEvent.click(screen.getByRole('button', { name: 'stage' }))
    await waitFor(() => { expect(stage).toHaveBeenCalledWith('ws-1', 'b.ts') })
    // Discard is a two-step action: confirm label appears first, then the call.
    fireEvent.click(screen.getByRole('button', { name: 'discard' }))
    expect(screen.getByRole('button', { name: 'discardConfirm' })).toBeTruthy()
    expect(discard).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'discardConfirm' }))
    await waitFor(() => { expect(discard).toHaveBeenCalledWith('ws-1', 'b.ts', true) })
  })

  it('refreshes the panel after a successful mutation and reports mutation failures', async () => {
    const stage = vi.fn<GitGraphInjected['stage']>()
      .mockResolvedValueOnce(okValue(undefined))
      .mockResolvedValueOnce(failValue('staging refused'))
    const graph = vi.fn<GitGraphInjected['graph']>(async () => okValue([]))
    const status = vi.fn<GitGraphInjected['status']>(async () => okValue([{ path: 'b.ts', index: ' ', worktree: 'M' }]))
    renderSection({ status, graph, stage })
    await waitFor(() => { expect(screen.getByText('b.ts')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'stage' }))
    await waitFor(() => { expect(graph).toHaveBeenCalledTimes(2) })
    fireEvent.click(screen.getByRole('button', { name: 'stage' }))
    await waitFor(() => { expect(screen.getByText(/staging refused/)).toBeTruthy() })
    expect(graph).toHaveBeenCalledTimes(2)
  })

  it('switches branches and surfaces the failure', async () => {
    const switchBranch = vi.fn<GitGraphInjected['switchBranch']>()
      .mockResolvedValueOnce(okValue(undefined))
      .mockResolvedValueOnce(failValue('working tree is not clean'))
    const graph = vi.fn<GitGraphInjected['graph']>(async () => okValue([]))
    renderSection({ switchBranch, graph })
    await waitFor(() => { expect(screen.getByRole('button', { name: 'switch' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'switch' }))
    await waitFor(() => { expect(switchBranch).toHaveBeenCalledWith('ws-1', 'dev') })
    expect(graph).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'switch' }))
    await waitFor(() => { expect(screen.getByText(/working tree is not clean/)).toBeTruthy() })
  })

  it('creates a branch on submit and ignores empty or repeated submissions', async () => {
    const createBranch = vi.fn<GitGraphInjected['createBranch']>(async () => okValue(undefined))
    renderSection({ createBranch })
    await waitFor(() => { expect(screen.getByLabelText('newBranch')).toBeTruthy() })
    const input = screen.getByLabelText('newBranch')
    const form = input.closest('form')!
    expect(screen.getByRole('button', { name: 'create' }).getAttribute('disabled')).not.toBeNull()
    fireEvent.submit(form)
    expect(createBranch).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'feat' } })
    fireEvent.submit(form)
    await waitFor(() => { expect(createBranch).toHaveBeenCalledWith('ws-1', 'feat') })
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('reports a create-branch failure', async () => {
    const createBranch = vi.fn<GitGraphInjected['createBranch']>(async () => failValue('invalid name'))
    renderSection({ createBranch })
    await waitFor(() => { expect(screen.getByLabelText('newBranch')).toBeTruthy() })
    const input = screen.getByLabelText('newBranch')
    fireEvent.change(input, { target: { value: 'bad name' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => { expect(screen.getByText(/invalid name/)).toBeTruthy() })
  })

  it('drops stale status and branch facets after a newer refresh', async () => {
    const pendingStatus: Array<(value: RemoteResult<{ path: string; index: string; worktree: string }[]>) => void> = []
    const pendingBranches: Array<(value: RemoteResult<{ current: string | null; branches: string[] }>) => void> = []
    const status = vi.fn<GitGraphInjected['status']>(() => new Promise((done) => { pendingStatus.push(done) }))
    const branches = vi.fn<GitGraphInjected['branches']>(() => new Promise((done) => { pendingBranches.push(done) }))
    renderSection({ status, branches, graph: async () => okValue([]) })
    await waitFor(() => { expect(status).toHaveBeenCalledTimes(1) })
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
    await waitFor(() => { expect(status).toHaveBeenCalledTimes(2) })
    pendingStatus[0]?.(okValue([{ path: 'stale.ts', index: 'M', worktree: ' ' }]))
    pendingBranches[0]?.(okValue({ current: 'old', branches: ['old'] }))
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(screen.queryByText('stale.ts')).toBeNull()
    pendingStatus[1]?.(okValue([{ path: 'fresh.ts', index: 'M', worktree: ' ' }]))
    pendingBranches[1]?.(okValue({ current: 'main', branches: ['main'] }))
    await waitFor(() => { expect(screen.getByText('fresh.ts')).toBeTruthy() })
  })

  it('ignores an older response after a newer refresh', async () => {
    const pending: Array<(value: Awaited<ReturnType<GitGraphInjected['graph']>>) => void> = []
    let graphCalls = 0
    const graph = vi.fn<GitGraphInjected['graph']>(() => {
      graphCalls += 1
      return new Promise((done) => { pending.push(done) })
    })
    const status = vi.fn<GitGraphInjected['status']>(async () => okValue([{ path: 'b.ts', index: ' ', worktree: 'M' }]))
    const stage = vi.fn<GitGraphInjected['stage']>(async () => okValue(undefined))
    renderSection({ graph, status, stage })
    await waitFor(() => { expect(screen.getByText('b.ts')).toBeTruthy() })
    // The mutation completes and starts a newer refresh (graph call 2).
    fireEvent.click(screen.getByRole('button', { name: 'stage' }))
    await waitFor(() => { expect(graphCalls).toBe(2) })
    pending[1]?.(okValue([commit('newer', [])]))
    await waitFor(() => { expect(screen.getByText('subject-newer')).toBeTruthy() })
    // The stale first response must not overwrite the newer commits.
    pending[0]?.(okValue([commit('older', [])]))
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(screen.queryByText('subject-older')).toBeNull()
    expect(screen.getByText('subject-newer')).toBeTruthy()
  })

  it('copies a hash on demand and reports the transient success label', async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
    Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })
    try {
      renderSection()
      await screen.findByText('subject-aaa111')
      fireEvent.click(screen.getAllByLabelText('copyHash')[0]!)
      await waitFor(() => { expect(screen.getByText('copied')).toBeTruthy() })
      expect(clipboard.writeText).toHaveBeenCalledWith('aaa111')
      await new Promise(resolve => setTimeout(resolve, 1100))
      expect(screen.queryByText('copied')).toBeNull()
    } finally {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    }
  })

  it('stays quiet when the clipboard write is refused', async () => {
    const clipboard = { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
    Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })
    try {
      renderSection()
      await screen.findByText('subject-aaa111')
      fireEvent.click(screen.getAllByLabelText('copyHash')[0]!)
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(screen.queryByText('copied')).toBeNull()
    } finally {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    }
  })
})
