/**
 * Package-owned execution prompts. Planning guidance stays deployment
 * `section` config; these strings run after an approved review.
 *
 * @module @deepseek-ai/dsh-plan-handoff/prompts
 */

/** Review option that approves and starts a fresh sibling session. */
export const APPROVE_EXECUTE = 'Approve and execute'

/** Review option that approves, compacts this session, then executes. */
export const APPROVE_COMPACT = 'Approve and compact context'

/** Review option that approves and executes with the planning transcript. */
export const APPROVE_KEEP = 'Approve and keep context'

/** Review option that stays in plan mode and returns feedback. */
export const REFINE_PLAN = 'Refine plan'

/** Labels that leave plan mode, in overlay order. */
export const APPROVE_LABELS = [APPROVE_EXECUTE, APPROVE_COMPACT, APPROVE_KEEP] as const

/**
 * Build the model-visible execution prompt after approval.
 *
 * @param input.plan - the approved markdown, required on compact/clear because
 *   those paths drop or replace the planning transcript.
 * @param input.contextPreserved - true when the planning history remains on
 *   the surface (keep, or compact after the summary lands).
 * @returns the user-message text steered into the execution turn.
 */
export function approvedPlanPrompt(input: {
  plan: string
  contextPreserved: boolean
}): string {
  const history = input.contextPreserved
    ? 'History is usable; if it conflicts with the plan below, the plan is authoritative.\n\n'
    : 'This turn has no planning conversation. Execute solely from the plan below.\n\n'
  return (
    history
    + 'Read the approved plan before any edit. Then execute it top-to-bottom with full tool access. '
    + 'Verify each step before the next. Do not re-plan or ask for another approval.\n\n'
    + input.plan
  )
}

/**
 * One-line tool-result narration for an approved execution mode.
 *
 * @param execution - the reviewer's chosen handoff.
 * @returns the text block the model sees as the successful tool result.
 */
export function approvedResultText(execution: 'clear' | 'compact' | 'keep'): string {
  switch (execution) {
    case 'clear':
      return 'Plan approved — a fresh session will execute it without this planning conversation.'
    case 'compact':
      return 'Plan approved — this session will compact the planning discussion, then execute the plan.'
    case 'keep':
      return 'Plan approved — plan mode exited; carry out the plan starting with your next step.'
    default: {
      const exhausted: never = execution
      return exhausted
    }
  }
}
