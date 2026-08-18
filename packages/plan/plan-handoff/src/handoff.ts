/**
 * Post-approval execution: keep this session, compact it, or open a sibling.
 *
 * @module @deepseek-ai/dsh-plan-handoff/handoff
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-presets'
import { ManualCompactionError } from '@deepseek-ai/dsh-compaction'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { PlanExecution } from './types.ts'
import { approvedPlanPrompt } from './prompts.ts'

/**
 * The session's compaction engine: the preset isolate first, then the host
 * plane. Shipped presets mount `compaction` behind `isolate`, which
 * `ctx.get('compaction')` on the agent or plan-handoff fiber cannot see.
 *
 * @param host - plan-handoff service context (not the source agent scope).
 * @param agent - session whose mounted composition to search.
 * @returns that session's engine, or undefined when none is composed.
 */
function resolveCompaction(host: Context, agent: Agent) {
  return host.get('agentPresets')?.serviceFor(agent, 'compaction') ?? host.get('compaction')
}

/** Approved plan waiting for the source agent to become idle. */
export interface PendingHandoff {
  execution: PlanExecution
  plan: string
  title: string
}

/** Result of one idle handoff attempt. */
export type HandoffOutcome =
  | { kind: 'kept' }
  | { kind: 'compacted' }
  | { kind: 'cleared'; childSessionId: SessionId }
  | { kind: 'compact-cancelled' }
  | { kind: 'cleared-fallback' }

/**
 * Steer the approved-plan prompt into an idle agent.
 *
 * @param agent - idle execution agent.
 * @param plan - approved markdown.
 * @param contextPreserved - whether planning history remains visible.
 */
export function steerApprovedPlan(
  agent: Agent,
  plan: string,
  contextPreserved: boolean,
): void {
  agent.steer(createUserMessage({
    content: [{ type: 'text', text: approvedPlanPrompt({ plan, contextPreserved }) }],
    source: {
      kind: 'plugin',
      plugin: 'plan-handoff',
      form: 'notice',
      summary: 'Execute the approved plan.',
    },
  }))
}

/**
 * Compact this session then steer the full plan. Cancellation skips the steer.
 *
 * @param host - plan-handoff service context, used to resolve compaction.
 * @param agent - idle source agent that can runMaintenance.
 * @param plan - approved markdown, embedded after compaction.
 * @param signal - forwarded to compactNow.
 * @returns compacted, cancelled, or kept when no compaction service exists.
 */
export async function compactThenExecute(
  host: Context,
  agent: Agent,
  plan: string,
  signal: AbortSignal,
): Promise<Extract<HandoffOutcome, { kind: 'compacted' | 'compact-cancelled' | 'kept' }>> {
  const compaction = resolveCompaction(host, agent)
  if (compaction === undefined) {
    steerApprovedPlan(agent, plan, true)
    return { kind: 'kept' }
  }
  try {
    await compaction.compactNow(agent, signal)
  } catch (error: unknown) {
    if (error instanceof ManualCompactionError && error.code === 'cancelled') {
      return { kind: 'compact-cancelled' }
    }
    host.logger.warn('dsh-plan-handoff: compaction failed; executing with current context: %o', error)
    steerApprovedPlan(agent, plan, true)
    return { kind: 'kept' }
  }
  steerApprovedPlan(agent, plan, true)
  return { kind: 'compacted' }
}

/**
 * Create a sibling session that inherits cwd, model, and preset, then steer.
 *
 * @param host - the plan-handoff service context (not the source agent scope).
 * @param source - idle planning agent.
 * @param plan - approved markdown; the child's first model-visible input.
 * @param title - first heading, used only for logging.
 * @returns cleared, or fallback compact/keep when create is unavailable.
 */
export async function clearThenExecute(
  host: Context,
  source: Agent,
  plan: string,
  title: string,
): Promise<Extract<HandoffOutcome, { kind: 'cleared' | 'cleared-fallback' }>> {
  const agents = host.get('agents')
  if (agents === undefined) {
    await compactThenExecute(host, source, plan, new AbortController().signal)
    return { kind: 'cleared-fallback' }
  }

  const presets = host.get('agentPresets')
  const presetId = presets?.composedPreset(source.ctx)
  const childId = SessionId(`session-${randomUUID()}`)
  try {
    const handle = await agents.create({
      sessionId: childId,
      meta: {
        ...source.session.header.cwd === undefined ? {} : { cwd: source.session.header.cwd },
        parentSession: source.id,
        seedLength: 0,
        ...presetId === undefined ? {} : { agentPreset: presetId },
      },
      agentOptions: { ...source.options },
      ...presets === undefined || presetId === undefined
        ? {}
        : {
          setup: async (agentCtx: Context) => {
            await presets.mount(agentCtx, presetId)
          },
        },
    })
    const cwd = source.session.header.cwd
    const workspaces = host.get('workspaceRegistry')
    if (workspaces !== undefined && cwd !== undefined) {
      const workspace = await workspaces.resolveByPath(cwd)
      if (workspace !== undefined) await workspace.attachSession(childId)
    }
    source.session.append('plan/handoff', { childSessionId: childId, mode: 'clear' })
    void title
    steerApprovedPlan(handle.agent, plan, false)
    return { kind: 'cleared', childSessionId: childId }
  } catch (error: unknown) {
    host.logger.warn('dsh-plan-handoff: failed to create execution session; falling back: %o', error)
    await compactThenExecute(host, source, plan, new AbortController().signal)
    return { kind: 'cleared-fallback' }
  }
}

/**
 * Run the pending handoff now that the source agent is idle.
 *
 * @param host - plan-handoff service context.
 * @param agent - idle source agent.
 * @param pending - recorded review choice and plan.
 * @returns what the handoff did.
 */
export async function runHandoff(
  host: Context,
  agent: Agent,
  pending: PendingHandoff,
): Promise<HandoffOutcome> {
  switch (pending.execution) {
    case 'keep':
      steerApprovedPlan(agent, pending.plan, true)
      return { kind: 'kept' }
    case 'compact':
      return compactThenExecute(host, agent, pending.plan, new AbortController().signal)
    case 'clear':
      return clearThenExecute(host, agent, pending.plan, pending.title)
    default: {
      const exhausted: never = pending.execution
      return exhausted
    }
  }
}
