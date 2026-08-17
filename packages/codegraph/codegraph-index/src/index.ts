/**
 * Host-plane CodeGraph index lifecycle. The Web GUI and optional auto-init
 * start `codegraph init`; the model-facing tool plugin never does.
 * @module @deepseek-ai/dsh-codegraph-index
 */

import { resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Session, SessionId } from '@deepseek-ai/dsh-session'
import { settingsNamespace, type SettingsScope } from '@deepseek-ai/dsh-settings'
import {
  buildInitArgv,
  createSpawnRunner,
  loadCodegraphBindings,
} from '@deepseek-ai/dsh-tool-codegraph'
import type { CodegraphProcessRunner } from '@deepseek-ai/dsh-tool-codegraph'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type { CodegraphIndexStatus, CodegraphSettings } from './types.ts'

export type * from './types.ts'

/** This host service has no loader config; settings live in the `codegraph` namespace. */
export type Config = Readonly<Record<string, never>>

/** Runtime schema for {@link Config}. */
export const Config = z.object({}) as unknown as z<Config>

/** Settings namespace written by the Web「代码索引」page. */
export const CODEGRAPH_SETTINGS_NAMESPACE = settingsNamespace('codegraph')

declare module '@deepseek-ai/cordis' {
  interface Context {
    codegraphIndex: CodegraphIndexService
  }
}

/** Injected engine faces so tests never spawn the real CLI. */
export interface CodegraphIndexDeps {
  /**
   * Whether `root` (or a walk from it) has a `.codegraph/` index.
   * @param root - absolute project path.
   */
  isInitialized(root: string): boolean
  /**
   * Run the vendored CodeGraph CLI.
   * @param argv - arguments after the script path.
   * @param options - abort signal for the child process.
   */
  run: CodegraphProcessRunner['run']
}

/** One in-flight init, keyed by resolved cwd. */
interface IndexJob {
  readonly projectPath: string
  readonly controller: AbortController
}

/** Schema of the `codegraph` settings section. */
const settingsSchema: z<CodegraphSettings> = z.object({
  autoInit: z.boolean().default(false),
})

/** Production engine: lazy bindings plus the bundled CLI runner. */
function defaultDeps(): CodegraphIndexDeps {
  const runner = createSpawnRunner()
  return {
    isInitialized(root) {
      return loadCodegraphBindings().isInitialized(root)
    },
    run(argv, options) {
      return runner.run(argv, options)
    },
  }
}

/** Host service (`ctx.codegraphIndex`) for user-triggered workspace indexing. */
export class CodegraphIndexService extends TypertRemoteService {
  static inject = ['sessions']

  private readonly deps: CodegraphIndexDeps
  private readonly jobs = new Map<string, IndexJob>()
  private readonly lastError = new Map<string, string>()
  private settings: SettingsScope<CodegraphSettings> | undefined

  /**
   * @param ctx - host context carrying live sessions.
   * @param _config - unused; the loader may pass an empty object.
   * @param deps - engine faces; tests pass fakes.
   */
  constructor(ctx: Context, _config: Config = {}, deps: CodegraphIndexDeps = defaultDeps()) {
    super(ctx, 'codegraphIndex')
    this.deps = deps
    ctx.inject(['settings'], (sctx) => {
      this.settings = sctx.settings.register(CODEGRAPH_SETTINGS_NAMESPACE, settingsSchema)
      sctx.effect(() => () => {
        this.settings = undefined
      })
    })
    ctx.on('session/created', (session) => {
      this.maybeAutoInit(session)
    }, { global: true })
    ctx.effect(() => () => {
      this.abortAll()
    }, 'codegraph-index.abortJobs')
  }

  /**
   * Read the current workspace index state for one live session.
   * The path is always `session.header.cwd`; the client cannot name another root.
   * @param sessionId - live session identity.
   * @returns the point-in-time status.
   */
  @Remote('status')
  status(sessionId: SessionId): CodegraphIndexStatus {
    return this.statusFor(this.requireSession(sessionId))
  }

  /**
   * Start `codegraph init` for the session cwd and return immediately.
   * A second call for the same resolved cwd joins the in-flight job.
   * @param sessionId - live session identity.
   * @returns the status after the start attempt (often `indexing: true`).
   */
  @Remote('init')
  init(sessionId: SessionId): CodegraphIndexStatus {
    const session = this.requireSession(sessionId)
    this.startInit(session)
    return this.statusFor(session)
  }

  /** Resolve a live session or fail the Remote call. */
  private requireSession(sessionId: SessionId): Session {
    const session = this.ctx.sessions.get(sessionId)
    if (session === undefined) {
      throw new Error(`session "${sessionId}" is not live`)
    }
    return session
  }

  /** Project status for one live session's header cwd. */
  private statusFor(session: Session): CodegraphIndexStatus {
    const cwd = session.header.cwd
    if (cwd === undefined || cwd === '') {
      return { projectPath: null, indexed: false, indexing: false }
    }
    const projectPath = resolve(cwd)
    if (this.jobs.has(projectPath)) {
      return { projectPath, indexed: false, indexing: true }
    }
    const probe = this.probe(projectPath)
    if (probe.indexed) return { projectPath, indexed: true, indexing: false }
    const error = probe.error ?? this.lastError.get(projectPath)
    return {
      projectPath,
      indexed: false,
      indexing: false,
      ...error === undefined ? {} : { error },
    }
  }

  /** Probe `.codegraph/` without pretending a failed engine load is indexed. */
  private probe(projectPath: string): { indexed: boolean; error?: string } {
    try {
      return { indexed: this.deps.isInitialized(projectPath) }
    } catch (error) {
      return {
        indexed: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /** Start init when auto-init is on and the cwd is not already indexed. */
  private maybeAutoInit(session: Session): void {
    if (this.settings?.get().autoInit !== true) return
    this.startInit(session)
  }

  /** Deduplicate by resolved cwd and spawn `codegraph init`. */
  private startInit(session: Session): void {
    const cwd = session.header.cwd
    if (cwd === undefined || cwd === '') return
    const projectPath = resolve(cwd)
    if (this.jobs.has(projectPath)) return
    const probe = this.probe(projectPath)
    if (probe.indexed) return
    this.lastError.delete(projectPath)
    const controller = new AbortController()
    const job: IndexJob = { projectPath, controller }
    this.jobs.set(projectPath, job)
    void this.deps.run(buildInitArgv(projectPath), { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return
        if (result.code !== 0) {
          const message = result.stderr.trim() || result.stdout.trim() || `codegraph init exited ${result.code}`
          this.lastError.set(projectPath, message)
        }
      }, (error: unknown) => {
        if (controller.signal.aborted) return
        this.lastError.set(projectPath, error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        if (this.jobs.get(projectPath) === job) this.jobs.delete(projectPath)
      })
  }

  /** Abort every in-flight spawn when the service fiber disposes. */
  private abortAll(): void {
    for (const job of this.jobs.values()) job.controller.abort()
    this.jobs.clear()
  }
}

export default CodegraphIndexService
