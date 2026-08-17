# Agent Note: Web `/codegraph-init` starts host-plane CodeGraph indexing

Status: implemented

English | [中文](2026-08-17-web-codegraph-init-command.zh.md)

## Problem

Web users could start CodeGraph indexing from the blank-session dock or **Settings → Code index**, but the slash-command catalog had no equivalent. A user who already thinks in `/compact` and `/export` had to leave the composer. Putting init on `@deepseek-ai/dsh-tool-codegraph` would let the model start indexing, which the [index-manager note](2026-08-13-web-codegraph-index-manager.md) forbids.

## Decision

`@deepseek-ai/dsh-command-codegraph-init` is a host-plane command consumer of `ctx.codegraphIndex`. It registers argument-free `/codegraph-init`. The handler calls `init(session.id)` on the receiving agent and maps the returned snapshot to a direct result. `init` still returns immediately; the command does not poll. The Web bundle mounts the plugin beside `codegraph-index`. CLI, headless, and ACP assemblies omit both.

Result text is stable and English:

| Snapshot | Direct result |
|---|---|
| `projectPath === null` | `This session has no workspace. Open a project before initializing CodeGraph.` |
| `indexed` | `CodeGraph index is already present at <path>.` |
| `indexing` | `Started CodeGraph indexing for <path>.` |
| leftover `error` | the manager's error line |
| unindexed, idle, no error | `CodeGraph index is not present at <path>.` |
| extra arguments | `Usage: /codegraph-init (no arguments)` |
| session not live | `This session is not live.` |

The executor records `command/run` / `command/done`. Init itself still does not enter the session log. The model-facing tool plugin still never runs init.

## Alternatives considered

**Wait until `indexed` or `error`.** Rejected: indexing can take minutes, and the manager is fire-and-forget. Progress already lives on the settings page and dock.

**Register the command in every preset.** Rejected: `codegraphIndex` is a host service. A preset row would wait forever on CLI and would be the wrong plane on Web.

**Let the command spawn `codegraph init` itself.** Rejected: that would duplicate job dedup, abort-on-dispose, and cwd confinement already owned by the index manager.

**Give `/codegraph-init` a path argument.** Rejected: the manager always indexes `session.header.cwd` so a client cannot name another root.

## Consequences

The Web command menu lists `/codegraph-init`. Typing it starts the same host job as the dock and settings page. CLI and headless users still run `codegraph init`. The agent still must not.

## Testing

Package tests cover registration, disposal, each snapshot mapping, argument rejection, session-not-live, unexpected rejection, and a real Loader composition. The assembled Web command-menu snapshot lists the new descriptor first.

## Related

- [Web host owns CodeGraph index init](2026-08-13-web-codegraph-index-manager.md)
- [Plugin-owned human command registration](2026-07-19-plugin-command-registration.md)
