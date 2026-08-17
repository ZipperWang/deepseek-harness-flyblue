import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import { SettingsProvider } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import CodegraphIndexService, {
  CODEGRAPH_SETTINGS_NAMESPACE,
  type CodegraphIndexDeps,
} from '@deepseek-ai/dsh-codegraph-index'

/** In-memory settings provider for autoInit tests. */
class MemorySettings extends SettingsProvider {
  doc: Record<string, unknown> = {}

  get writable(): boolean {
    return true
  }

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve(structuredClone(this.doc))
  }

  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.doc = { ...this.doc, [ns]: structuredClone(section) }
    return Promise.resolve()
  }
}

const projectPath = resolve(tmpdir(), 'codegraph-index-proj')

/** Scriptable engine faces plus a hanging init latch. */
function fakeDeps(options: {
  indexed?: boolean | ((root: string) => boolean)
  probeError?: Error
  init?: () => Promise<{ stdout: string; stderr: string; code: number }>
} = {}): CodegraphIndexDeps & { runs: string[][]; aborts: number } {
  const state = { runs: [] as string[][], aborts: 0 }
  return {
    runs: state.runs,
    get aborts() { return state.aborts },
    isInitialized(root) {
      if (options.probeError !== undefined) throw options.probeError
      return typeof options.indexed === 'function' ? options.indexed(root) : options.indexed === true
    },
    run(argv, runOptions) {
      state.runs.push(argv)
      return new Promise((resolve, reject) => {
        const onAbort = (): void => {
          state.aborts += 1
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        }
        if (runOptions.signal.aborted) {
          onAbort()
          return
        }
        runOptions.signal.addEventListener('abort', onAbort, { once: true })
        void (options.init ?? (async () => ({ stdout: '', stderr: '', code: 0 })))()
          .then(resolve, reject)
          .finally(() => {
            runOptions.signal.removeEventListener('abort', onAbort)
          })
      })
    },
  }
}

/** Boot the service over a live session store. */
async function harness(deps: CodegraphIndexDeps, withSettings = true): Promise<{
  ctx: Context
  service: CodegraphIndexService
  create: (cwd?: string) => ReturnType<SessionStore['create']>
}> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  if (withSettings) {
    await ctx.plugin(MemorySettings)
  }
  class TestService extends CodegraphIndexService {
    constructor(serviceCtx: Context) {
      super(serviceCtx, {}, deps)
    }
  }
  await ctx.plugin(TestService)
  return {
    ctx,
    service: ctx.codegraphIndex,
    create: cwd => ctx.sessions.create(SessionId(`s-${Math.random()}`), cwd === undefined ? undefined : { meta: { cwd } }),
  }
}

describe('CodegraphIndexService', () => {
  it('reports an unindexed workspace and does not spawn', async () => {
    const deps = fakeDeps({ indexed: false })
    const { ctx, service, create } = await harness(deps)
    const session = create(projectPath)
    expect(service.status(session.id)).toEqual({
      projectPath,
      indexed: false,
      indexing: false,
    })
    expect(deps.runs).toEqual([])
    await ctx.fiber.dispose()
  })

  it('reports an already-indexed workspace without spawning', async () => {
    const deps = fakeDeps({ indexed: true })
    const { ctx, service, create } = await harness(deps)
    const session = create(projectPath)
    expect(service.status(session.id)).toEqual({
      projectPath,
      indexed: true,
      indexing: false,
    })
    expect(service.init(session.id)).toEqual({
      projectPath,
      indexed: true,
      indexing: false,
    })
    expect(deps.runs).toEqual([])
    await ctx.fiber.dispose()
  })

  it('skips status and init when the session has no cwd', async () => {
    const deps = fakeDeps()
    const { ctx, service, create } = await harness(deps)
    const session = create()
    expect(service.status(session.id)).toEqual({
      projectPath: null,
      indexed: false,
      indexing: false,
    })
    expect(service.init(session.id)).toEqual({
      projectPath: null,
      indexed: false,
      indexing: false,
    })
    expect(deps.runs).toEqual([])
    await ctx.fiber.dispose()
  })

  it('starts init immediately and returns indexing status', async () => {
    let finish!: (result: { stdout: string; stderr: string; code: number }) => void
    const deps = fakeDeps({
      init: () => new Promise((resolve) => { finish = resolve }),
    })
    const { ctx, service, create } = await harness(deps)
    const session = create(projectPath)
    expect(service.init(session.id)).toEqual({
      projectPath,
      indexed: false,
      indexing: true,
    })
    expect(deps.runs).toEqual([['init', projectPath]])
    finish({ stdout: '', stderr: '', code: 0 })
    await vi.waitFor(() => {
      expect(service.status(session.id).indexing).toBe(false)
    })
    await ctx.fiber.dispose()
  })

  it('deduplicates concurrent init for the same cwd', async () => {
    let finish!: (result: { stdout: string; stderr: string; code: number }) => void
    const deps = fakeDeps({
      init: () => new Promise((resolve) => { finish = resolve }),
    })
    const { ctx, service, create } = await harness(deps)
    const a = create(projectPath)
    const b = create(projectPath)
    expect(service.init(a.id).indexing).toBe(true)
    expect(service.init(b.id).indexing).toBe(true)
    expect(deps.runs).toHaveLength(1)
    finish({ stdout: '', stderr: '', code: 0 })
    await vi.waitFor(() => {
      expect(service.status(a.id).indexing).toBe(false)
    })
    await ctx.fiber.dispose()
  })

  it('records a non-zero init exit as a retryable error', async () => {
    const deps = fakeDeps({
      init: async () => ({ stdout: '', stderr: 'index failed\n', code: 1 }),
    })
    const { ctx, service, create } = await harness(deps)
    const session = create(projectPath)
    service.init(session.id)
    await vi.waitFor(() => {
      expect(service.status(session.id)).toEqual({
        projectPath,
        indexed: false,
        indexing: false,
        error: 'index failed',
      })
    })
    await ctx.fiber.dispose()
  })

  it('surfaces a failed engine probe without pretending the workspace is indexed', async () => {
    const deps = fakeDeps({ probeError: new Error('engine missing') })
    const { ctx, service, create } = await harness(deps)
    const session = create(projectPath)
    expect(service.status(session.id)).toEqual({
      projectPath,
      indexed: false,
      indexing: false,
      error: 'engine missing',
    })
    await ctx.fiber.dispose()
  })

  it('starts init on session/created when autoInit is on and the cwd is unindexed', async () => {
    let finish!: (result: { stdout: string; stderr: string; code: number }) => void
    const deps = fakeDeps({
      init: () => new Promise((resolve) => { finish = resolve }),
    })
    const { ctx, service, create } = await harness(deps)
    await ctx.settings.update(CODEGRAPH_SETTINGS_NAMESPACE, { autoInit: true })
    const session = create(projectPath)
    expect(service.status(session.id).indexing).toBe(true)
    expect(deps.runs).toEqual([['init', projectPath]])
    finish({ stdout: '', stderr: '', code: 0 })
    await vi.waitFor(() => {
      expect(service.status(session.id).indexing).toBe(false)
    })
    await ctx.fiber.dispose()
  })

  it('does not auto-init when autoInit is off', async () => {
    const deps = fakeDeps()
    const { ctx, create } = await harness(deps)
    create(projectPath)
    expect(deps.runs).toEqual([])
    await ctx.fiber.dispose()
  })

  it('skips auto-init when the session has no cwd', async () => {
    const deps = fakeDeps()
    const { ctx, create } = await harness(deps)
    await ctx.settings.update(CODEGRAPH_SETTINGS_NAMESPACE, { autoInit: true })
    create()
    expect(deps.runs).toEqual([])
    await ctx.fiber.dispose()
  })

  it('aborts in-flight init when the service fiber disposes', async () => {
    const deps = fakeDeps({
      init: () => new Promise(() => {}),
    })
    const { ctx, service, create } = await harness(deps)
    const session = create(projectPath)
    expect(service.init(session.id).indexing).toBe(true)
    await ctx.fiber.dispose()
    expect(deps.aborts).toBe(1)
  })

  it('rejects status for a session that is not live', async () => {
    const deps = fakeDeps()
    const { ctx, service } = await harness(deps)
    expect(() => service.status(SessionId('missing'))).toThrow(/not live/)
    await ctx.fiber.dispose()
  })
})
