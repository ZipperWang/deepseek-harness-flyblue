// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { formatDate, TaskBoardSection } from '../src/client/section.tsx'
import type { TaskBoardInjected } from '../src/client/section.tsx'

type Task = { id: string; title: string; archived: boolean; createdAt: number; updatedAt: number }
afterEach(cleanup)
const t = (key: string) => key
const okValue = <T,>(value: T): RemoteResult<T> => ({ ok: true, value })
const failValue = (message: string): RemoteResult<never> => ({ ok: false, error: { code: 'Error', message, details: {} } })
const task = (id: string, title: string, archived = false, createdAt = 1000) => (
  { id, title, archived, createdAt, updatedAt: createdAt + 100 }
)
const initialTasks = [task('t1', 'ship the release'), task('t2', 'write tests', true)]

interface Verbs {
  list?: TaskBoardInjected['list']
  create?: TaskBoardInjected['create']
  archive?: TaskBoardInjected['archive']
  update?: TaskBoardInjected['update']
  remove?: TaskBoardInjected['remove']
}

function renderSection(verbs: Verbs = {}) {
  const resolved: TaskBoardInjected = {
    list: verbs.list ?? (async () => okValue(initialTasks)),
    create: verbs.create ?? (async () => okValue(task('t3', 'created'))),
    archive: verbs.archive ?? (async () => okValue({ ...task('t1', 'ship the release'), archived: true })),
    update: verbs.update ?? (async () => okValue(task('t1', 'renamed'))),
    remove: verbs.remove ?? (async () => okValue(task('t2', 'write tests', true))),
  }
  render(<TaskBoardSection t={t as never} {...resolved} />)
  return resolved
}

describe('formatDate', () => {
  it('renders a locale-aware short date', () => {
    const value = new Date(2026, 7, 18).getTime()
    const label = formatDate(value)
    expect(label.length).toBeGreaterThan(0)
  })
})

describe('TaskBoardSection', () => {
  it('shows a skeleton, then active tasks with counts', async () => {
    let resolveList!: (value: RemoteResult<Task[]>) => void
    const list = vi.fn<TaskBoardInjected['list']>(() => new Promise((done) => { resolveList = done }))
    renderSection({ list })
    expect(screen.getByLabelText('loading')).toBeTruthy()
    resolveList(okValue(initialTasks))
    await waitFor(() => { expect(screen.getByText('ship the release')).toBeTruthy() })
    expect(screen.getByText(/count\.active/)).toBeTruthy()
    expect(screen.getByText(/count\.archived/)).toBeTruthy()
    expect(screen.queryByText('write tests')).toBeNull()
  })

  it('switches between the active and archived tabs', async () => {
    renderSection()
    await screen.findByText('ship the release')
    expect(screen.queryByText('write tests')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'tab.archived' }))
    expect(screen.getByRole('button', { name: 'tab.archived' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('write tests')).toBeTruthy()
    expect(screen.queryByText('ship the release')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'tab.active' }))
    expect(screen.getByText('ship the release')).toBeTruthy()
  })

  it('creates a task on submit and ignores empty or repeated submissions', async () => {
    const create = vi.fn<TaskBoardInjected['create']>(async () => okValue(task('t3', 'new task')))
    const list = vi.fn<TaskBoardInjected['list']>()
      .mockResolvedValueOnce(okValue(initialTasks))
      .mockResolvedValueOnce(okValue([...initialTasks, task('t3', 'new task')]))
    renderSection({ create, list })
    await screen.findByText('ship the release')
    const input = screen.getByLabelText('createAria')
    const form = input.closest('form')!
    expect(screen.getByRole('button', { name: 'create' }).getAttribute('disabled')).not.toBeNull()
    fireEvent.submit(form)
    expect(create).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'new task' } })
    fireEvent.submit(form)
    await waitFor(() => { expect(create).toHaveBeenCalledWith('new task', expect.any(String)) })
    await waitFor(() => { expect(screen.getByText('new task')).toBeTruthy() })
    expect((input as HTMLInputElement).value).toBe('')
    expect(list).toHaveBeenCalledTimes(2) // initial load + post-create refresh
  })

  it('reports a create failure', async () => {
    const create = vi.fn<TaskBoardInjected['create']>(async () => failValue('title is required'))
    renderSection({ create })
    await screen.findByText('ship the release')
    const input = screen.getByLabelText('createAria')
    fireEvent.change(input, { target: { value: 'oops' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => { expect(screen.getByText(/title is required/)).toBeTruthy() })
  })

  it('ignores an empty rename submit', async () => {
    const update = vi.fn<TaskBoardInjected['update']>(async () => okValue(task('t1', 'renamed')))
    renderSection({ update })
    await screen.findByText('ship the release')
    fireEvent.click(screen.getByRole('button', { name: 'rename' }))
    fireEvent.change(screen.getByLabelText('renameAria'), { target: { value: '   ' } })
    fireEvent.submit(screen.getByLabelText('renameAria').closest('form')!)
    expect(update).not.toHaveBeenCalled()
  })

  it('archives optimistically and reconciles from the host response', async () => {
    const archive = vi.fn<TaskBoardInjected['archive']>(async () => okValue({ ...task('t1', 'ship the release'), archived: true }))
    const list = vi.fn<TaskBoardInjected['list']>()
      .mockResolvedValueOnce(okValue(initialTasks))
      .mockResolvedValueOnce(okValue([{ ...task('t1', 'ship the release'), archived: true }, task('t2', 'write tests', true)]))
    renderSection({ archive, list })
    await screen.findByText('ship the release')
    fireEvent.click(screen.getByRole('button', { name: 'archive' }))
    // Optimistic: the row leaves the active tab immediately.
    await waitFor(() => { expect(screen.queryByText('ship the release')).toBeNull() })
    fireEvent.click(screen.getByRole('button', { name: 'tab.archived' }))
    await waitFor(() => { expect(screen.getByText('ship the release')).toBeTruthy() })
    expect(archive).toHaveBeenCalledWith('t1', expect.any(String))
  })

  it('rolls an optimistic archive back and reports the failure', async () => {
    const archive = vi.fn<TaskBoardInjected['archive']>(async () => failValue('ledger locked'))
    renderSection({ archive })
    await screen.findByText('ship the release')
    fireEvent.click(screen.getByRole('button', { name: 'archive' }))
    await waitFor(() => { expect(screen.getByText(/ledger locked/)).toBeTruthy() })
    expect(screen.getByText('ship the release')).toBeTruthy()
  })

  it('renames a task inline and cancels the edit', async () => {
    const update = vi.fn<TaskBoardInjected['update']>(async () => okValue(task('t1', 'renamed title')))
    const list = vi.fn<TaskBoardInjected['list']>()
      .mockResolvedValueOnce(okValue(initialTasks))
      .mockResolvedValueOnce(okValue([task('t1', 'renamed title'), task('t2', 'write tests', true)]))
    renderSection({ update, list })
    await screen.findByText('ship the release')
    fireEvent.click(screen.getByRole('button', { name: 'rename' }))
    const input = screen.getByLabelText('renameAria')
    fireEvent.change(input, { target: { value: 'renamed title' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => { expect(update).toHaveBeenCalledWith('t1', 'renamed title', expect.any(String)) })
    await waitFor(() => { expect(screen.getByText('renamed title')).toBeTruthy() })
    // Cancel path: start another edit and back out without saving.
    fireEvent.click(screen.getByRole('button', { name: 'rename' }))
    fireEvent.change(screen.getByLabelText('renameAria'), { target: { value: 'discarded' } })
    fireEvent.click(screen.getByRole('button', { name: 'renameCancel' }))
    expect(screen.queryByLabelText('renameAria')).toBeNull()
    expect(screen.getByText('renamed title')).toBeTruthy()
  })

  it('reports a rename failure and keeps the edit open', async () => {
    const update = vi.fn<TaskBoardInjected['update']>(async () => failValue('title required'))
    renderSection({ update })
    await screen.findByText('ship the release')
    fireEvent.click(screen.getByRole('button', { name: 'rename' }))
    const input = screen.getByLabelText('renameAria')
    fireEvent.change(input, { target: { value: 'renamed' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => { expect(screen.getByText(/title required/)).toBeTruthy() })
    expect(screen.getByLabelText('renameAria')).toBeTruthy()
  })

  it('deletes an archived task behind a two-step confirmation', async () => {
    const remove = vi.fn<TaskBoardInjected['remove']>(async () => okValue(task('t2', 'write tests', true)))
    const list = vi.fn<TaskBoardInjected['list']>()
      .mockResolvedValueOnce(okValue(initialTasks))
      .mockResolvedValueOnce(okValue([task('t1', 'ship the release')]))
    renderSection({ remove, list })
    await screen.findByText('ship the release')
    fireEvent.click(screen.getByRole('button', { name: 'tab.archived' }))
    fireEvent.click(screen.getByRole('button', { name: 'delete' }))
    expect(screen.getByRole('button', { name: 'deleteConfirm' })).toBeTruthy()
    expect(remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'deleteConfirm' }))
    await waitFor(() => { expect(remove).toHaveBeenCalledWith('t2', expect.any(String)) })
    await waitFor(() => { expect(screen.queryByText('write tests')).toBeNull() })
    expect(screen.getByText('empty.archived')).toBeTruthy()
  })

  it('keeps an archived task when deletion fails', async () => {
    const remove = vi.fn<TaskBoardInjected['remove']>(async () => failValue('must archive first'))
    renderSection({ remove })
    await screen.findByText('ship the release')
    fireEvent.click(screen.getByRole('button', { name: 'tab.archived' }))
    fireEvent.click(screen.getByRole('button', { name: 'delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'deleteConfirm' }))
    await waitFor(() => { expect(screen.getByText(/must archive first/)).toBeTruthy() })
    expect(screen.getByText('write tests')).toBeTruthy()
  })

  it('shows the empty state per tab', async () => {
    renderSection({ list: async () => okValue([]) })
    await waitFor(() => { expect(screen.getByText('empty.active')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'tab.archived' }))
    expect(screen.getByText('empty.archived')).toBeTruthy()
  })

  it('renders the error banner and recovers through retry', async () => {
    const list = vi.fn<TaskBoardInjected['list']>()
      .mockResolvedValueOnce(failValue('ledger unavailable'))
      .mockResolvedValueOnce(okValue(initialTasks))
    renderSection({ list })
    await waitFor(() => { expect(screen.getByText(/ledger unavailable/)).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => { expect(screen.getByText('ship the release')).toBeTruthy() })
    expect(screen.queryByText(/ledger unavailable/)).toBeNull()
  })

  it('ignores a stale list response after a newer refresh', async () => {
    const pending: Array<(value: RemoteResult<Task[]>) => void> = []
    let calls = 0
    const list = vi.fn<TaskBoardInjected['list']>(() => {
      calls += 1
      return new Promise((done) => { pending.push(done) })
    })
    const create = vi.fn<TaskBoardInjected['create']>(async () => okValue(task('t3', 'new task')))
    renderSection({ list, create })
    const input = screen.getByLabelText('createAria')
    fireEvent.change(input, { target: { value: 'new task' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => { expect(calls).toBe(2) })
    // The post-create refresh lands first with the created task.
    pending[1]?.({ ok: true, value: [task('t3', 'new task')] })
    await waitFor(() => { expect(screen.getByText('new task')).toBeTruthy() })
    // The stale initial response must not wipe it.
    pending[0]?.({ ok: true, value: [] })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(screen.getByText('new task')).toBeTruthy()
  })
})
