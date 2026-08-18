/** Package-owned durable plan-handoff invariants. @module @deepseek-ai/dsh-plan-handoff/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-plan-handoff'

/** Cordis companion plugin name. */
export const name = 'plan-handoff-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * Validate one `plan/mode` event before it reaches the durable log.
 * `plan/mode` is a standalone whole-value event: an idle selection commits
 * between turns and a mid-turn selection commits at the step boundary, so
 * no turn-enclosure relation exists — only the payload shape is checkable.
 */
function validateEvent(event: SessionEvent, fail: InvariantFailure): void {
  if (event.type === 'plan/mode') {
    const active = (event.data as { active?: unknown }).active
    if (typeof active !== 'boolean') {
      fail(`plan/mode carries invalid active state ${JSON.stringify(active)}; expected a boolean`)
    }
    return
  }
  if (event.type === 'plan/handoff') {
    const data = event.data as { childSessionId?: unknown; mode?: unknown }
    if (typeof data.childSessionId !== 'string' || data.childSessionId === '') {
      fail('plan/handoff requires a non-empty childSessionId')
    }
    if (data.mode !== 'clear') {
      fail(`plan/handoff carries invalid mode ${JSON.stringify(data.mode)}; expected "clear"`)
    }
    return
  }
  if (event.type === 'plan/approved') {
    const data = event.data as { execution?: unknown; title?: unknown }
    if (data.execution !== 'clear' && data.execution !== 'compact' && data.execution !== 'keep') {
      fail(`plan/approved carries invalid execution ${JSON.stringify(data.execution)}`)
    }
    if (typeof data.title !== 'string' || data.title.trim() === '') {
      fail('plan/approved requires a non-empty title')
    }
  }
}

/** Install validation for loaded and newly appended plan-mode state. */
const install: InvariantInstaller = Object.assign((ctx: Context, fail: InvariantFailure) => {
  const seed = (session: Session): void => {
    for (const event of session.events) validateEvent(event, fail)
  }
  for (const session of ctx.sessions.list()) seed(session)
  ctx.on('session/created', (session) => { seed(session) }, { global: true })
  ctx.on('internal/dispatch', (_mode, eventName, args) => {
    if (eventName !== 'session/event') return
    const [, event] = args as [Session, SessionEvent]
    validateEvent(event, fail)
  }, { global: true })
}, { inject: ['sessions'] })

/**
 * Register the plan-mode invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
