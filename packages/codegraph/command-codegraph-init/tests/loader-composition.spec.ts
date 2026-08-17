import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import type { Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import * as commandCodegraphInit from '@deepseek-ai/dsh-command-codegraph-init'
import { Session, SessionId } from '@deepseek-ai/dsh-session'

const PROJECT = '/tmp/loader-command-codegraph-init'

/** Loader-mounted stub that publishes `ctx.codegraphIndex`. */
const stubIndex = {
  name: 'stub-codegraph-index',
  apply(ctx: Context): void {
    ctx.provide('codegraphIndex', {
      init: () => ({ projectPath: PROJECT, indexed: false, indexing: true }),
    })
  },
}

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('command-codegraph-init real Loader composition', () => {
  it('discovers and executes /codegraph-init through the assembled command plane', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-command-codegraph-init-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-commands'",
      "- name: '@test/codegraph-index'",
      "- name: '@deepseek-ai/dsh-command-codegraph-init'",
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-commands', CommandRuntime],
      ['@test/codegraph-index', stubIndex],
      ['@deepseek-ai/dsh-command-codegraph-init', commandCodegraphInit],
    ])
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await context.loader.await()

    const session = Session.create(SessionId('loader-command-codegraph-init'))
    const agent = {
      session,
      status: 'idle',
      options: {},
      reserveTurnAdmission: () => () => undefined,
    } as unknown as Agent
    expect(context.commands.list(agent)).toContainEqual({
      name: 'codegraph-init',
      description: 'Initialize the CodeGraph index for this workspace',
    })
    const execution = await context.commands.execute(
      agent,
      '/codegraph-init',
      new AbortController().signal,
    )
    if (execution === undefined) throw new Error('Loader composition did not resolve /codegraph-init')
    expect(execution.result).toEqual({
      kind: 'success',
      text: `Started CodeGraph indexing for ${PROJECT}.`,
    })
    expect(session.events.map(event => ({ type: event.type, data: event.data }))).toEqual([
      {
        type: 'command/run',
        data: {
          commandId: execution.commandId,
          name: 'codegraph-init',
          args: '',
          source: { kind: 'user' },
        },
      },
      {
        type: 'command/done',
        data: {
          commandId: execution.commandId,
          kind: 'success',
          text: `Started CodeGraph indexing for ${PROJECT}.`,
        },
      },
    ])
    expect(session.surface.nodes).toEqual([])
    expect(session.deriveMessages()).toEqual([])
  })
})
