import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { CodegraphIndexStatus } from '@deepseek-ai/dsh-codegraph-index'
import CommandRuntime, { type CommandResult } from '@deepseek-ai/dsh-commands'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import * as commandCodegraphInit from '@deepseek-ai/dsh-command-codegraph-init'

const PROJECT = '/tmp/command-codegraph-init-proj'

/** Scriptable host-plane index manager. */
class StubCodegraphIndex {
  initCalls: SessionId[] = []
  next: CodegraphIndexStatus = { projectPath: PROJECT, indexed: false, indexing: true }
  failure: unknown

  constructor(ctx: Context) {
    ctx.provide('codegraphIndex', this)
  }

  /**
   * Record the session id and return the scripted snapshot, or throw.
   * @param sessionId - live session identity from the command handler.
   */
  init(sessionId: SessionId): CodegraphIndexStatus {
    this.initCalls.push(sessionId)
    if (this.failure !== undefined) throw this.failure
    return this.next
  }
}

interface Harness {
  readonly ctx: Context
  readonly index: StubCodegraphIndex
  readonly agent: Agent
  readonly plugin: Awaited<ReturnType<Context['plugin']>>
}

async function harness(): Promise<Harness> {
  const ctx = new Context()
  await ctx.plugin(CommandRuntime)
  const index = new StubCodegraphIndex(ctx)
  const plugin = await ctx.plugin(commandCodegraphInit)
  const session = Session.create(SessionId('command-codegraph-init'))
  const agent = {
    session,
    status: 'idle',
    options: {},
    reserveTurnAdmission: () => () => undefined,
  } as unknown as Agent
  return { ctx, index, agent, plugin }
}

async function run(
  test: Harness,
  suffix = '',
): Promise<NonNullable<Awaited<ReturnType<CommandRuntime['execute']>>>> {
  const execution = await test.ctx.commands.execute(
    test.agent,
    `/codegraph-init${suffix}`,
    new AbortController().signal,
  )
  if (execution === undefined) throw new Error('codegraph-init command was not registered')
  return execution
}

/** Assert the executor-owned lifecycle pair and absence from model history. */
function expectLastLifecycle(test: Harness, args: string, outcome: CommandResult): string {
  const lifecycle = test.agent.session.events
    .filter(event => event.type === 'command/run' || event.type === 'command/done')
    .slice(-2)
  const runEvent = lifecycle[0]
  const doneEvent = lifecycle[1]
  if (runEvent?.type !== 'command/run' || doneEvent?.type !== 'command/done') {
    throw new Error(`expected command lifecycle pair, got ${lifecycle.map(event => event.type).join(',')}`)
  }
  expect(lifecycle.map(event => ({ type: event.type, data: event.data }))).toEqual([
    {
      type: 'command/run',
      data: {
        commandId: runEvent.data.commandId,
        name: 'codegraph-init',
        args,
        source: { kind: 'user' },
      },
    },
    {
      type: 'command/done',
      data: {
        commandId: runEvent.data.commandId,
        ...outcome,
      },
    },
  ])
  expect(doneEvent.data.commandId).toBe(runEvent.data.commandId)
  expect(test.agent.session.surface.nodes).toEqual([])
  expect(test.agent.session.deriveMessages()).toEqual([])
  return runEvent.data.commandId
}

describe('@deepseek-ai/dsh-command-codegraph-init registration', () => {
  it('registers one argument-free command with Loader-safe exports and disposes it', async () => {
    const test = await harness()
    expect(commandCodegraphInit.name).toBe('command-codegraph-init')
    expect(commandCodegraphInit.inject).toEqual(['commands', 'codegraphIndex'])
    expect('default' in commandCodegraphInit).toBe(false)
    const loader = Object.create(Loader.prototype) as Loader
    expect(loader.unwrapExports(commandCodegraphInit)).toBe(commandCodegraphInit)
    expect(test.ctx.commands.list(test.agent)).toContainEqual({
      name: 'codegraph-init',
      description: 'Initialize the CodeGraph index for this workspace',
    })

    await test.plugin.dispose()
    expect(test.ctx.commands.find(test.agent, 'codegraph-init')).toBeUndefined()
  })
})

describe('/codegraph-init human command', () => {
  it('starts indexing and forwards the receiving session id', async () => {
    const test = await harness()
    const execution = await run(test)
    expect(execution.result).toEqual({
      kind: 'success',
      text: `Started CodeGraph indexing for ${PROJECT}.`,
    })
    expect(execution.commandId).toBe(expectLastLifecycle(test, '', execution.result))
    expect(test.index.initCalls).toEqual([test.agent.session.id])
  })

  it('reports an already-indexed workspace without treating it as failure', async () => {
    const test = await harness()
    test.index.next = { projectPath: PROJECT, indexed: true, indexing: false }
    const execution = await run(test)
    expect(execution.result).toEqual({
      kind: 'success',
      text: `CodeGraph index is already present at ${PROJECT}.`,
    })
    expect(execution.commandId).toBe(expectLastLifecycle(test, '', execution.result))
  })

  it('returns direct errors for no workspace, leftover init failure, and missing index', async () => {
    const test = await harness()
    test.index.next = { projectPath: null, indexed: false, indexing: false }
    const missing = await run(test)
    expect(missing.result).toEqual({
      kind: 'error',
      text: 'This session has no workspace. Open a project before initializing CodeGraph.',
    })
    expect(missing.commandId).toBe(expectLastLifecycle(test, '', missing.result))

    test.index.next = {
      projectPath: PROJECT,
      indexed: false,
      indexing: false,
      error: 'codegraph init exited 1',
    }
    const failed = await run(test)
    expect(failed.result).toEqual({ kind: 'error', text: 'codegraph init exited 1' })
    expect(failed.commandId).toBe(expectLastLifecycle(test, '', failed.result))

    test.index.next = { projectPath: PROJECT, indexed: false, indexing: false }
    const absent = await run(test)
    expect(absent.result).toEqual({
      kind: 'error',
      text: `CodeGraph index is not present at ${PROJECT}.`,
    })
    expect(absent.commandId).toBe(expectLastLifecycle(test, '', absent.result))
  })

  it('rejects arguments without calling the index manager', async () => {
    const test = await harness()
    const rejected = await run(test, ' now')
    expect(rejected.result).toEqual({
      kind: 'error',
      text: 'Usage: /codegraph-init (no arguments)',
    })
    expect(rejected.commandId).toBe(expectLastLifecycle(test, ' now', rejected.result))
    expect(test.index.initCalls).toEqual([])
  })

  it('maps a missing live session to a direct error and rethrows unexpected failures', async () => {
    const missing = await harness()
    missing.index.failure = new Error(`session "${missing.agent.session.id}" is not live`)
    const execution = await run(missing)
    expect(execution.result).toEqual({ kind: 'error', text: 'This session is not live.' })
    expect(execution.commandId).toBe(expectLastLifecycle(missing, '', execution.result))

    const unexpected = await harness()
    const bug = new Error('unexpected index manager bug')
    unexpected.index.failure = bug
    await expect(run(unexpected)).rejects.toBe(bug)
    expectLastLifecycle(unexpected, '', { kind: 'error', text: bug.message })
  })
})
