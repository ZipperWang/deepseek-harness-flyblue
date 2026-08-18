# Agent Note: Plan handoff after review

Status: implemented

English | [中文](2026-08-19-plan-handoff.zh.md)

## Problem

Shipped plan mode left the planning transcript in place after `Approve`. Long explorations then forced the implementer to sift tool noise, and a later compaction could drop the decisions the plan was supposed to carry. OMP treats the plan as an execution spec and lets the operator choose keep, compact, or a fresh session. DSH already rejected plan files and write-gating; those constraints still hold.

## Decision

`@deepseek-ai/dsh-plan-handoff` is the shipped plan plugin. It keeps `ctx.planMode`, `plan/mode`, `/plan`, and `exit_plan_mode`. The review offers three leaving labels — `Approve and execute`, `Approve and compact context`, `Approve and keep context` — plus `Refine plan`. `AskUserQuestionIntent` for `plan-review` names those leaving labels as `approve: string[]`. The Web card renders every approve path plus refine; the generic flow remains the fallback.

After the source agent is idle, keep steers the full plan here; compact and clear conclude the current turn first so the model does not take another step against the planning transcript. Compact resolves the session engine through `AgentPresets.serviceFor(agent, 'compaction')` or host `ctx.compaction` — shipped presets isolate `compaction`, so `agent.ctx.get('compaction')` cannot see it — then runs `compactNow` and steers (cancel skips the steer; failure or a missing engine keeps context). Clear creates a sibling session with the same cwd, model, and preset, logs `plan/handoff` on the source, and steers the plan into the child. Hosts without `ctx.agents.create` treat clear as compact-then-steer. The Web `SessionManager` selects the child when a live `plan/handoff` arrives on the current session, or when that child later appears in the list. `plan/mode`, `plan/handoff`, and `plan/approved` are declared on the package `types`/`client` face so Client programs that import that outlet see them on `SessionEventMap`.

The plan markdown stays on the tool argument and is copied into the execution prompt. There is no plan file and no write interceptor.

## Alternatives considered

**Evolve `@deepseek-ai/dsh-plan-mode` in place.** Rejected: the requested delivery is a replacement plugin. The old package is removed; shipped compositions mount `dsh-plan-handoff`.

**Same-session surface replace for clear.** Rejected: the chosen product meaning is a new session, matching OMP's approve-and-execute.

**Hard write blocking during plan mode.** Rejected: plan mode stays guidance; sandbox and approval stay the enforcement axes.

**Plan files under `local://`.** Rejected: the existing collaboration-state note already refused a second durable home. The execution prompt is the model-visible copy.

## Consequences

Approval is no longer a single continue-here step. Compact and clear cost a session factory or compaction service; without them the plugin degrades instead of failing closed. The review card is no longer binary, so [plan review as a decision](2026-07-30-plan-review-presentation-intent.md) now names a set of approve labels. Soft guidance and the log-only `plan/mode` fold from [plan-specific collaboration state](../simplification/2026-07-22-plan-specific-collaboration-state.md) still hold.

## Testing

Package tests cover the previous plan-mode machine plus keep/compact/clear idle handoff, host-plane and isolated-preset compact lookup, an isolated engine that `serviceFor` does not publish, compact cancellation, and the no-factory clear fallback. `user-questions` and `ui-user-questions` pin `approve: string[]` and the four-action card. `SessionManager` selects a listed child after a live `plan/handoff`.
