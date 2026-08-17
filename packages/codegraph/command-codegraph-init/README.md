# @deepseek-ai/dsh-command-codegraph-init

English | [中文](README.zh.md)

Human-facing `/codegraph-init` control over [`ctx.codegraphIndex`](../codegraph-index/README.md). The plugin registers one global command through [`ctx.commands`](../../interaction/commands/README.md), so every composed command adapter discovers and executes it without a model turn. The [Web `/codegraph-init` Agent Note](../../../.agents/notes/implemented/feature/2026-08-17-web-codegraph-init-command.md) owns the composition and result-text decisions.

## Command contract

| Input | Result |
|---|---|
| `/codegraph-init` on an unindexed workspace | `Started CodeGraph indexing for <path>.` — `init` returns immediately; the host job continues in the background. |
| `/codegraph-init` when an index already exists | `CodeGraph index is already present at <path>.` — the manager does not spawn again. |
| `/codegraph-init` with no session workspace | `This session has no workspace. Open a project before initializing CodeGraph.` |
| `/codegraph-init` after a failed start that did not begin a job | the manager's `error` line, or `CodeGraph index is not present at <path>.` when no error is current. |
| `/codegraph-init <anything>` | `Usage: /codegraph-init (no arguments)` — the command takes no arguments and does not call the manager. |

The command is a consumer only: it calls `init(session.id)` on the receiving agent's session and maps the returned snapshot to a direct result. A missing live session becomes `This session is not live.` Unexpected implementation failures reject dispatch. Every resolved invocation records the executor-owned log-only pair `command/run` / `command/done`; neither event joins model history. Init itself is not written to the session log.

## Composition

The producer injects `commands` and `codegraphIndex`. Mount the command registry, the host index manager, and this plugin:

```yaml
- id: commands
  name: '@deepseek-ai/dsh-commands'
- id: codegraph-index
  name: '@deepseek-ai/dsh-codegraph-index'
- id: command-codegraph-init
  name: '@deepseek-ai/dsh-command-codegraph-init'
```

The shipped Web bundle mounts it beside `codegraph-index`. CLI, headless, and ACP assemblies do not mount the index manager, so they do not register this command.

## Model Experience

### Human `/codegraph-init` control

#### What the model sees

The slash input and direct result never enter a model request. Creating `.codegraph/` is visible to the model only through later `codegraph_explore` results.

#### Token effect

The command lifecycle adds no model tokens.

#### KV Cache effect

Discovery and command bookkeeping do not affect the cache. A later successful explore result is an independent model request.

## Known Limitations and Deferred Work

- **Fire-and-forget** — the command reports that indexing started; it does not wait for `indexed` or `error`. Progress stays on the Web「代码索引」page and the blank-session dock.
- **Web host only** — surfaces without `ctx.codegraphIndex` omit the command. CLI and headless users still run `codegraph init`.
- **No path argument** — the manager always indexes `session.header.cwd`.
