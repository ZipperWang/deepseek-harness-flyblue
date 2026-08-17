/**
 * Human-facing `/codegraph-init` command over the host CodeGraph index manager.
 * @module @deepseek-ai/dsh-command-codegraph-init
 */

import type { Context } from '@deepseek-ai/cordis'
import type { CodegraphIndexStatus } from '@deepseek-ai/dsh-codegraph-index'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'

export const name = 'command-codegraph-init'
export const inject = ['commands', 'codegraphIndex']

const USAGE = 'Usage: /codegraph-init (no arguments)'
const NO_WORKSPACE = 'This session has no workspace. Open a project before initializing CodeGraph.'
const SESSION_NOT_LIVE = 'This session is not live.'
const SESSION_NOT_LIVE_RE = /^session ".+" is not live$/u

/** Convert one point-in-time index snapshot into a direct command result. */
function resultFor(status: CodegraphIndexStatus): CommandResult {
  if (status.projectPath === null) {
    return { kind: 'error', text: NO_WORKSPACE }
  }
  if (status.indexed) {
    return { kind: 'success', text: `CodeGraph index is already present at ${status.projectPath}.` }
  }
  if (status.indexing) {
    return { kind: 'success', text: `Started CodeGraph indexing for ${status.projectPath}.` }
  }
  if (status.error !== undefined) {
    return { kind: 'error', text: status.error }
  }
  return { kind: 'error', text: `CodeGraph index is not present at ${status.projectPath}.` }
}

/** Execute one argument-free host-plane index start. */
function executeInit(ctx: Context, invocation: CommandInvocation): CommandResult {
  if (invocation.rawInput.trim().length > 0) {
    return { kind: 'error', text: USAGE }
  }
  try {
    return resultFor(ctx.codegraphIndex.init(invocation.agent.session.id))
  } catch (error: unknown) {
    if (error instanceof Error && SESSION_NOT_LIVE_RE.test(error.message)) {
      return { kind: 'error', text: SESSION_NOT_LIVE }
    }
    throw error
  }
}

/**
 * Register `/codegraph-init` for every composed human-command adapter.
 * @param ctx - context carrying the command registry and the index manager.
 */
export function apply(ctx: Context): void {
  ctx.commands.register({
    name: 'codegraph-init',
    description: 'Initialize the CodeGraph index for this workspace',
    handler: invocation => executeInit(ctx, invocation),
  })
}
