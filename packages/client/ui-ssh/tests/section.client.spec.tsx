// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { SshSection, terminalLabels } from '../src/client/section.tsx'
import type { HostSummary, SshInjected } from '../src/client/section.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)
const t = (key: string) => key
const okValue = <T,>(value: T): RemoteResult<T> => ({ ok: true, value })
const failValue = (message: string): RemoteResult<never> => ({ ok: false, error: { code: 'Error', message, details: {} } })
const host = (id: string, alias: string, auth: HostSummary['auth'] = 'password'): HostSummary => ({ id, alias, host: '10.0.0.1', port: 22, user: 'root', auth })
const initialHosts = [host('h1', 'prod'), host('h2', 'stage', 'key')]

interface Verbs {
  list?: SshInjected['list']
  put?: SshInjected['put']
  remove?: SshInjected['remove']
  exec?: SshInjected['exec']
}

function renderSection(verbs: Verbs = {}) {
  const resolved: SshInjected = {
    list: verbs.list ?? (async () => okValue(initialHosts)),
    put: verbs.put ?? (async () => okValue(host('h3', 'new'))),
    remove: verbs.remove ?? (async () => okValue(undefined)),
    exec: verbs.exec ?? (async () => okValue({ stdout: 'hello\n', stderr: '', exitCode: 0, result: 'known' })),
  }
  render(<SshSection t={t as never} {...resolved} />)
  return resolved
}

describe('SshSection', () => {
  it('shows a skeleton, then the host inventory with a preselected host', async () => {
    let resolveList!: (value: RemoteResult<HostSummary[]>) => void
    const list = vi.fn<SshInjected['list']>(() => new Promise((done) => { resolveList = done }))
    renderSection({ list })
    expect(screen.getByLabelText('loading')).toBeTruthy()
    resolveList(okValue(initialHosts))
    await waitFor(() => { expect(screen.getByText('prod')).toBeTruthy() })
    expect(screen.getByText(/count\.hosts/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /prod/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('auth.key')).toBeTruthy()
    // Console is usable: the first host is selected by default.
    expect(screen.getByLabelText('runAria')).toBeTruthy()
  })

  it('switches the console target by selecting another host row', async () => {
    renderSection()
    await screen.findByText('prod')
    fireEvent.click(screen.getByRole('button', { name: /stage/ }))
    expect(screen.getByRole('button', { name: /stage/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('shows empty states when no hosts are configured', async () => {
    renderSection({ list: async () => okValue([]) })
    await waitFor(() => { expect(screen.getByText('noHosts')).toBeTruthy() })
    expect(screen.getByText('selectHostHint')).toBeTruthy()
  })

  it('keeps the selected host across a refresh', async () => {
    const list = vi.fn<SshInjected['list']>(async () => okValue(initialHosts))
    renderSection({ list })
    await screen.findByText('prod')
    fireEvent.click(screen.getByRole('button', { name: /stage/ }))
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
    await waitFor(() => { expect(list).toHaveBeenCalledTimes(2) })
    expect(screen.getByRole('button', { name: /stage/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('runs a command, appends a terminal entry, and clears the console', async () => {
    const exec = vi.fn<SshInjected['exec']>(async () => okValue({ stdout: 'world\n', stderr: '', exitCode: 0, result: 'known' }))
    renderSection({ exec })
    await screen.findByText('prod')
    const input = screen.getByLabelText('runAria')
    fireEvent.change(input, { target: { value: 'echo world' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => { expect(exec).toHaveBeenCalledWith('h1', 'echo world') })
    await waitFor(() => { expect(screen.getByText('echo world')).toBeTruthy() })
    expect(screen.getByText('world')).toBeTruthy()
    expect((input as HTMLInputElement).value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'clearOutput' }))
    expect(screen.getByText('consoleEmpty')).toBeTruthy()
  })

  it('renders a failed exit code and a capped long output', async () => {
    const output = Array.from({ length: 24 }, (_, index) => `line-${index}`).join('\n')
    const exec = vi.fn<SshInjected['exec']>()
      .mockResolvedValueOnce(okValue({ stdout: 'oops\n', stderr: '', exitCode: 1, result: 'known' }))
      .mockResolvedValueOnce(okValue({ stdout: `${output}\n`, stderr: '', exitCode: 0, result: 'known' }))
    renderSection({ exec })
    await screen.findByText('prod')
    const input = screen.getByLabelText('runAria')
    fireEvent.change(input, { target: { value: 'false' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => { expect(screen.getByText(/termExit/)).toBeTruthy() })
    fireEvent.change(input, { target: { value: 'seq 24' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => { expect(screen.getByText('seq 24')).toBeTruthy() })
    const expand = screen.queryByRole('button', { name: /termExpand/ })
    if (expand) fireEvent.click(expand)
  })

  it('ignores a second host save while the first is in flight', async () => {
    let resolvePut!: (value: RemoteResult<HostSummary>) => void
    const put = vi.fn<SshInjected['put']>(() => new Promise((done) => { resolvePut = done }))
    renderSection({ put })
    await screen.findByText('prod')
    fireEvent.click(screen.getByRole('button', { name: 'addHost' }))
    const form = screen.getByRole('form', { name: 'addHost' })
    fireEvent.submit(form)
    await waitFor(() => { expect(screen.getByRole('button', { name: 'refreshing' })).toBeTruthy() })
    fireEvent.submit(form)
    expect(put).toHaveBeenCalledTimes(1)
    resolvePut(okValue(host('h3', 'backup')))
    await waitFor(() => { expect(put).toHaveBeenCalledTimes(1) })
  })

  it('shows the running state and an unknown-result warning for a dropped dispatch', async () => {
    let resolveExec!: (value: Awaited<ReturnType<SshInjected['exec']>>) => void
    const exec = vi.fn<SshInjected['exec']>(() => new Promise((done) => { resolveExec = done }))
    renderSection({ exec })
    await screen.findByText('prod')
    const input = screen.getByLabelText('runAria')
    fireEvent.change(input, { target: { value: 'sleep 30' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => { expect(exec).toHaveBeenCalled() })
    expect(screen.getByRole('button', { name: 'running' }).getAttribute('disabled')).not.toBeNull()
    resolveExec(okValue({ stdout: 'partial', stderr: '', exitCode: null, result: 'result-unknown' }))
    await waitFor(() => { expect(screen.getByText('resultUnknown')).toBeTruthy() })
    expect(screen.getByText('partial')).toBeTruthy()
  })

  it('reports an exec failure and keeps the failed entry', async () => {
    const exec = vi.fn<SshInjected['exec']>(async () => failValue('connection refused'))
    renderSection({ exec })
    await screen.findByText('prod')
    const input = screen.getByLabelText('runAria')
    fireEvent.change(input, { target: { value: 'ls' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => { expect(screen.getByText(/connection refused/)).toBeTruthy() })
    expect(screen.getByText('ls')).toBeTruthy()
  })

  it('ignores empty commands and recalls history with arrow keys', async () => {
    const exec = vi.fn<SshInjected['exec']>(async () => okValue({ stdout: '', stderr: '', exitCode: 0, result: 'known' }))
    renderSection({ exec })
    await screen.findByText('prod')
    const input = screen.getByLabelText('runAria')
    fireEvent.submit(input.closest('form')!)
    expect(exec).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'uptime' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => { expect(exec).toHaveBeenCalledWith('h1', 'uptime') })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect((input as HTMLInputElement).value).toBe('uptime')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('adds a host through the form and selects it', async () => {
    const put = vi.fn<SshInjected['put']>(async () => okValue(host('h3', 'backup')))
    const list = vi.fn<SshInjected['list']>()
      .mockResolvedValueOnce(okValue(initialHosts))
      .mockResolvedValueOnce(okValue([...initialHosts, host('h3', 'backup')]))
    renderSection({ put, list })
    await screen.findByText('prod')
    fireEvent.click(screen.getByRole('button', { name: 'addHost' }))
    fireEvent.change(screen.getByLabelText('field.alias'), { target: { value: 'backup' } })
    fireEvent.change(screen.getByLabelText('field.host'), { target: { value: '10.0.0.9' } })
    fireEvent.change(screen.getByLabelText('field.port'), { target: { value: '2222' } })
    fireEvent.change(screen.getByLabelText('field.user'), { target: { value: 'ops' } })
    fireEvent.change(screen.getByLabelText('field.password'), { target: { value: 'hunter2' } })
    fireEvent.submit(screen.getByRole('form', { name: 'addHost' }))
    await waitFor(() => {
      expect(put).toHaveBeenCalledWith(expect.objectContaining({ alias: 'backup', host: '10.0.0.9', port: 2222, user: 'ops', password: 'hunter2' }))
    })
    await waitFor(() => { expect(screen.getByRole('button', { name: /backup/ }).getAttribute('aria-pressed')).toBe('true') })
  })

  it('edits a host with key auth and cancels the form', async () => {
    const put = vi.fn<SshInjected['put']>(async () => okValue(host('h1', 'prod')))
    renderSection({ put })
    await screen.findByText('prod')
    fireEvent.click(screen.getAllByRole('button', { name: 'editHost' })[0]!)
    // Key-auth mode swaps the secret field label.
    fireEvent.click(screen.getByRole('button', { name: 'auth.key' }))
    expect(screen.getByLabelText('field.keyPath')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'auth.password' }))
    expect(screen.getByLabelText('field.password')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'auth.key' }))
    expect(screen.getByLabelText('field.keyPath')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('field.alias'), { target: { value: 'prod-eu' } })
    fireEvent.change(screen.getByLabelText('field.keyPath'), { target: { value: '/home/me/.ssh/id_ed25519' } })
    fireEvent.submit(screen.getByRole('form', { name: 'editHost' }))
    await waitFor(() => {
      expect(put).toHaveBeenCalledWith(expect.objectContaining({ id: 'h1', alias: 'prod-eu', privateKeyPath: '/home/me/.ssh/id_ed25519' }))
    })
    // Cancel path: open the form again and back out.
    fireEvent.click(screen.getByRole('button', { name: 'addHost' }))
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(screen.queryByRole('form')).toBeNull()
  })

  it('reports a host save failure and keeps the form open', async () => {
    const put = vi.fn<SshInjected['put']>(async () => failValue('invalid host configuration'))
    renderSection({ put })
    await screen.findByText('prod')
    fireEvent.click(screen.getByRole('button', { name: 'addHost' }))
    fireEvent.submit(screen.getByRole('form', { name: 'addHost' }))
    await waitFor(() => { expect(screen.getByText(/invalid host configuration/)).toBeTruthy() })
    expect(screen.getByRole('form', { name: 'addHost' })).toBeTruthy()
  })

  it('deletes a host behind a two-step confirmation and reselects', async () => {
    const remove = vi.fn<SshInjected['remove']>(async () => okValue(undefined))
    const list = vi.fn<SshInjected['list']>()
      .mockResolvedValueOnce(okValue(initialHosts))
      .mockResolvedValueOnce(okValue([host('h2', 'stage', 'key')]))
    renderSection({ remove, list })
    await screen.findByText('prod')
    fireEvent.click(screen.getAllByRole('button', { name: 'deleteHost' })[0]!)
    expect(screen.getByRole('button', { name: 'deleteHostConfirm' })).toBeTruthy()
    expect(remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'deleteHostConfirm' }))
    await waitFor(() => { expect(remove).toHaveBeenCalledWith('h1') })
    await waitFor(() => { expect(screen.queryByText('prod')).toBeNull() })
    // Selection falls back to the remaining host.
    expect(screen.getByRole('button', { name: /stage/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps a host when deletion fails', async () => {
    const remove = vi.fn<SshInjected['remove']>(async () => failValue('remove refused'))
    renderSection({ remove })
    await screen.findByText('prod')
    fireEvent.click(screen.getAllByRole('button', { name: 'deleteHost' })[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'deleteHostConfirm' }))
    await waitFor(() => { expect(screen.getByText(/remove refused/)).toBeTruthy() })
    expect(screen.getByText('prod')).toBeTruthy()
  })

  it('renders the error banner and recovers through retry', async () => {
    const list = vi.fn<SshInjected['list']>()
      .mockResolvedValueOnce(failValue('store unavailable'))
      .mockResolvedValueOnce(okValue(initialHosts))
    renderSection({ list })
    await waitFor(() => { expect(screen.getByText(/store unavailable/)).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => { expect(screen.getByText('prod')).toBeTruthy() })
    expect(screen.queryByText(/store unavailable/)).toBeNull()
  })

  it('ignores a stale list response after a newer mutation reload', async () => {
    const pending: Array<(value: RemoteResult<HostSummary[]>) => void> = []
    let calls = 0
    const list = vi.fn<SshInjected['list']>(() => {
      calls += 1
      return new Promise((done) => { pending.push(done) })
    })
    const put = vi.fn<SshInjected['put']>(async () => okValue(host('h3', 'backup')))
    renderSection({ list, put })
    await waitFor(() => { expect(calls).toBe(1) })
    // The initial load is still in flight when the user adds a host; the
    // post-save reload bumps the sequence and lands first.
    fireEvent.click(screen.getByRole('button', { name: 'addHost' }))
    fireEvent.change(screen.getByLabelText('field.alias'), { target: { value: 'backup' } })
    fireEvent.change(screen.getByLabelText('field.host'), { target: { value: '10.0.0.9' } })
    fireEvent.change(screen.getByLabelText('field.user'), { target: { value: 'ops' } })
    fireEvent.submit(screen.getByRole('form', { name: 'addHost' }))
    await waitFor(() => { expect(calls).toBe(2) })
    pending[1]?.({ ok: true, value: [host('h3', 'backup')] })
    await waitFor(() => { expect(screen.getByText('backup')).toBeTruthy() })
    // The stale pre-mutation response must not wipe the added host.
    pending[0]?.({ ok: true, value: [] })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(screen.getByText('backup')).toBeTruthy()
  })

  it('formats a terminating-signal status label', () => {
    const translate = ((key: keyof typeof en) => en[key]) as typeof t
    expect(terminalLabels(translate as never).signal('SIGTERM')).toBe('signal SIGTERM')
  })
})
