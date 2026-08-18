# @deepseek-ai/dsh-plan-handoff

English | [中文](README.zh.md)

Logged, per-agent plan collaboration state with deployment-owned guidance, `/plan [message]` entry, `/plan off` exit, and a reviewed `exit_plan_mode` that offers keep / compact / clear execution after approval. Plan mode is soft guidance; sandbox mode and approval policy enforce restrictions independently.

This package replaces `@deepseek-ai/dsh-plan-mode` in shipped compositions. `ctx.planMode`, `plan/mode`, `/plan`, and `exit_plan_mode` keep the same names.

## Durable state

`plan/mode` (`{ active: boolean }`) is a log-only, whole-value-replace `SessionEventMap` member. `foldPlanMode(events)` returns the last logged value or `false`. `ctx.planMode.set` / `get` match the previous package: idle commits immediately; an open turn stays pending until the next accepted in-turn pre-step.

An approved review also appends `plan/approved` `{ execution, title }`. A clear handoff appends `plan/handoff` `{ childSessionId, mode: 'clear' }` on the source session.

## Review and execution

`exit_plan_mode` stays registered in both states. In plan mode it requires a markdown plan starting with a `#` heading and asks through `ctx.userQuestions` with four options:

- `Approve and execute` — conclude the current turn, then after the source agent is idle, create a sibling session (same cwd, model, and preset), attach it to the same workspace, log `plan/handoff`, and steer the full plan into the child.
- `Approve and compact context` — conclude the current turn, then `compactNow` on this session, then steer the full plan. The Chat view shows `Compacting context…` from the standalone `compaction/start` until the checkpoint lands; only then does the plugin steer. Compaction is resolved through `AgentPresets.serviceFor(agent, 'compaction')` (the shipped isolated preset realm) or host `ctx.compaction`. Cancellation skips the steer. Failure or a missing engine falls back to keep.
- `Approve and keep context` — steer the full plan into this session.
- `Refine plan` — stay in plan mode; feedback returns as a failed call.

A TUI or other host without `ctx.agents.create` treats clear as compact-then-steer.

The Web client selects the child when it sees a live `plan/handoff` on the current session, or when that child later appears in the session list. Historical replay does not switch.

## Configuration

```yaml
- id: plan-mode
  name: '@deepseek-ai/dsh-plan-handoff'
  config:
    section: |
      You are in plan mode. Explore and write a decision-complete execution spec
      through exit_plan_mode.
```

`section` is required and non-empty. Unknown keys fail at load.

## Model Experience

### Plan policy system prompt

#### What the model sees

While plan mode is active, the model sees the deployment's exact `section` text as the `plan:policy` section at prompt order 50; inactive mode contributes no text.

##### Plan policy

```markdown
You are in plan mode. Explore and write a decision-complete execution spec
through exit_plan_mode.
```

#### Token effect

Inactive mode adds no tokens; active mode adds the configured section to every request.

#### KV Cache effect

The section is stable within plan mode, but entering or leaving changes the system prompt from order 50 onward.

### Exit tool and execution prompt

#### What the model sees

The [`exit_plan_mode` schema](../../../docs/tool-catalog.md#deepseek-aidsh-plan-handoff) stays available in both states. Approval returns `{ approved: true, execution }` and a mode-specific confirmation. After idle, a plugin-sourced user message carries the approved plan and tells the model to execute it.

#### Token effect

The stable schema is paid according to ToolRuntime mode. Keep adds one execution prompt. Compact replaces earlier surface nodes with a summary, then adds the full plan. Clear starts a new session whose first model-visible input is that prompt.

#### KV Cache effect

Mode transitions do not change the tool catalog. Compact replaces a surface prefix. Clear is a new session prefix.

## Known Limitations and Deferred Work

- **Clear needs a session factory** — without `ctx.agents` the path falls back to compact-then-steer, which is the TUI/headless case.
- **Compact needs a reachable engine** — without `AgentPresets.serviceFor(agent, 'compaction')` or host `ctx.compaction` the path keeps context.
- **No plan files** — the approved markdown lives on the tool argument and is copied into the execution prompt; there is no `local://` artifact.
- **Soft guidance only** — a model that ignores the section can still mutate; configure sandbox and approval independently.
- **User-copied presets that still name `@deepseek-ai/dsh-plan-mode`** fail to load until that row is renamed.
- A selection made after the turn's final accepted pre-step is lost if the process exits before another accepted in-turn pre-step.
- Compaction uses the generic summarizer; the steered plan is the authoritative source after compact.
