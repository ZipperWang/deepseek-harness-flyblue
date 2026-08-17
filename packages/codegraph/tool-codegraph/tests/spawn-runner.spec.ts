import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { createSpawnRunner, resolveCodegraphCli } from '@deepseek-ai/dsh-tool-codegraph'
import type { SpawnFn } from '@deepseek-ai/dsh-tool-codegraph/src/spawn-runner.ts'

class FakeChild extends EventEmitter {
  stdout = new EventEmitter()
  stderr = new EventEmitter()
}

describe('resolveCodegraphCli', () => {
  it('joins npm-shim.js onto the package directory', () => {
    const requireImpl = ((() => {
      throw new Error('unused')
    }) as unknown as NodeJS.Require)
    requireImpl.resolve = ((id: string) => {
      expect(id).toBe('@colbymchenry/codegraph/package.json')
      return '/mods/@colbymchenry/codegraph/package.json'
    }) as NodeJS.RequireResolve
    expect(resolveCodegraphCli(requireImpl).replaceAll('\\', '/'))
      .toBe('/mods/@colbymchenry/codegraph/npm-shim.js')
  })
})

describe('createSpawnRunner', () => {
  it('collects stdio and the exit code', async () => {
    const child = new FakeChild()
    const spawnFn = vi.fn(() => child) as unknown as SpawnFn
    const runner = createSpawnRunner('/cli.js', spawnFn)
    const pending = runner.run(['explore', '--path', '/repo', 'q'], { signal: new AbortController().signal })
    child.stdout.emit('data', Buffer.from('out'))
    child.stderr.emit('data', Buffer.from('err'))
    child.emit('close', 0)
    await expect(pending).resolves.toEqual({ stdout: 'out', stderr: 'err', code: 0 })
    expect(spawnFn).toHaveBeenCalledWith(
      process.execPath,
      ['/cli.js', 'explore', '--path', '/repo', 'q'],
      expect.objectContaining({ windowsHide: true }),
    )
  })

  it('treats a missing code as 1 and forwards spawn errors', async () => {
    const closing = new FakeChild()
    const runner = createSpawnRunner('/cli.js', (() => closing) as unknown as SpawnFn)
    const pending = runner.run(['status', '/repo'], { signal: new AbortController().signal })
    closing.emit('close', null)
    await expect(pending).resolves.toMatchObject({ code: 1 })

    const failing = new FakeChild()
    const failingRunner = createSpawnRunner('/cli.js', (() => failing) as unknown as SpawnFn)
    const rejected = failingRunner.run(['status', '/repo'], { signal: new AbortController().signal })
    failing.emit('error', new Error('ENOENT'))
    await expect(rejected).rejects.toThrow('ENOENT')
  })
})
