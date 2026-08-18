import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { Session, SessionId, type UserMessage } from '@deepseek-ai/dsh-session'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import { createScope } from '@deepseek-ai/dsh-scope'
import UserQuestionService, { type AskUserQuestionRequest } from '@deepseek-ai/dsh-user-questions'
import { ManualCompactionError } from '@deepseek-ai/dsh-compaction'
import PlanModeController, {
  APPROVE_COMPACT, APPROVE_EXECUTE, APPROVE_KEEP, EXIT_PLAN_MODE,
  approvedPlanPrompt, approvedResultText,
} from '../src/index.ts'

const PLAN_CONFIG = { section: 'Test plan mode instructions.' }

async function agentWithSession(
  ctx: Context,
  id = 'agent-1',
  extra: { steer?: (message: UserMessage) => void; status?: Agent['status'] } = {},
): Promise<Agent & { session: Session }> {
  const session = Session.create(SessionId(id))
  session.append('plan/mode', { active: true })
  const agent = {
    id: SessionId(id),
    session,
    options: { provider: 'mock', model: 'mock' },
    status: extra.status ?? 'running',
    inject(message: UserMessage) {
      session.append('user/message', message, { surfaceOp: 'append' })
    },
    steer: extra.steer ?? ((_message: UserMessage) => undefined),
  } as unknown as Agent & { session: Session }
  let scoped!: Context
  await ctx.plugin(Object.assign((inner: Context) => { scoped = createScope(inner, agent).ctx }, {
    inject: ['tools'],
  }))
  ;(agent as { ctx?: Context }).ctx = scoped
  const agents = ctx.get('agents')
  if (agents === undefined) ctx.emit('agent/created', { agent })
  else {
    agents.enter(agent, undefined)
    agents.announce(agent)
  }
  return agent
}

async function setup() {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(PlanModeController, PLAN_CONFIG)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(UserQuestionService)
  return ctx
}

function callExit(ctx: Context, agent: Agent, selected: string) {
  ctx.userQuestions.registerProvider({
    ask: (_request: AskUserQuestionRequest) => Promise.resolve({
      answers: [{ id: 'plan-review', selected: [selected] }],
    }),
  })
  return ctx.tools.execute({
    callId: CallId(`exit-${selected}`),
    name: EXIT_PLAN_MODE,
    arguments: { plan: '# Title\n\nDo the work.' },
    signal: new AbortController().signal,
    agent,
  })
}

describe('approved prompts', () => {
  it('states whether history is preserved', () => {
    expect(approvedPlanPrompt({ plan: '# P', contextPreserved: true })).toContain('History is usable')
    expect(approvedPlanPrompt({ plan: '# P', contextPreserved: false })).toContain('no planning conversation')
  })

  it('narrates each execution mode', () => {
    expect(approvedResultText('clear')).toContain('fresh session')
    expect(approvedResultText('compact')).toContain('compact')
    expect(approvedResultText('keep')).toContain('next step')
  })
})

describe('approved execution handoff', () => {
  it('keep steers the plan when the source is already idle', async () => {
    const ctx = await setup()
    const steered: UserMessage[] = []
    const agent = await agentWithSession(ctx, 'keep', {
      status: 'idle',
      steer: (message) => { steered.push(message) },
    })
    const result = await callExit(ctx, agent, APPROVE_KEEP)
    expect(result.isError).toBe(false)
    if (result.isError) throw new Error('expected approval')
    expect(result.value).toEqual({ approved: true, execution: 'keep' })
    expect(steered).toHaveLength(1)
    expect(steered[0]?.content[0]).toMatchObject({ type: 'text' })
    expect(agent.session.events.some(event => event.type === 'plan/approved')).toBe(true)
  })

  it('compact calls compactNow then steers', async () => {
    const ctx = await setup()
    const compactNow = vi.fn(async () => null)
    const steered: UserMessage[] = []
    const agent = await agentWithSession(ctx, 'compact', {
      status: 'idle',
      steer: (message) => { steered.push(message) },
    })
    agent.ctx.provide('compaction', { compactNow } as never)
    const result = await callExit(ctx, agent, APPROVE_COMPACT)
    expect(result.isError).toBe(false)
    expect(compactNow).toHaveBeenCalledOnce()
    expect(steered).toHaveLength(1)
  })

  it('compact cancellation does not steer', async () => {
    const ctx = await setup()
    const steered: UserMessage[] = []
    const agent = await agentWithSession(ctx, 'cancel', {
      status: 'idle',
      steer: (message) => { steered.push(message) },
    })
    agent.ctx.provide('compaction', {
      compactNow: () => Promise.reject(new ManualCompactionError('cancelled', 'cancelled')),
    } as never)
    await callExit(ctx, agent, APPROVE_COMPACT)
    expect(steered).toHaveLength(0)
  })

  it('compact non-cancel failure falls back to keep and steers', async () => {
    const ctx = await setup()
    const steered: UserMessage[] = []
    const agent = await agentWithSession(ctx, 'compact-fail', {
      status: 'idle',
      steer: (message) => { steered.push(message) },
    })
    agent.ctx.provide('compaction', {
      compactNow: () => Promise.reject(new Error('summarizer down')),
    } as never)
    await callExit(ctx, agent, APPROVE_COMPACT)
    expect(steered).toHaveLength(1)
  })

  it('clear without a session factory falls back to compact-then-steer', async () => {
    const ctx = await setup()
    const steered: UserMessage[] = []
    const agent = await agentWithSession(ctx, 'fallback', {
      status: 'idle',
      steer: (message) => { steered.push(message) },
    })
    const result = await callExit(ctx, agent, APPROVE_EXECUTE)
    expect(result.isError).toBe(false)
    if (result.isError) throw new Error('expected approval')
    expect(result.value).toEqual({ approved: true, execution: 'clear' })
    expect(steered).toHaveLength(1)
    expect(agent.session.events.some(event => event.type === 'plan/handoff')).toBe(false)
  })
})
