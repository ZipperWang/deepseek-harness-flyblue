# Agent Note: Web host owns CodeGraph index init

Status: implemented

English | [中文](2026-08-13-web-codegraph-index-manager.zh.md)

## Problem

A new Web session on an unindexed workspace only learned that fact after the model called `codegraph_explore`. There was no product prompt, no settings page, and no way to start `codegraph init` except by hand in a terminal. Putting settings or a session prompt on `@deepseek-ai/dsh-tool-codegraph` would register a settings namespace from a preset plugin. The same preset can mount in several sessions, and that duplicate registration fails.

## Decision

Index lifecycle is a host-plane service, `@deepseek-ai/dsh-codegraph-index` (`ctx.codegraphIndex`). The Web bundle mounts it before any session exists. Remote methods are `status(sessionId)` and `init(sessionId)`. Both read `session.header.cwd` on the host. `init` returns immediately; the UI polls `status`. One resolved cwd shares one in-flight spawn. Fiber dispose aborts unfinished jobs.

The `codegraph` settings namespace is `{ autoInit: boolean }`, default `false`. When true, `session/created` starts init for a session that has a cwd and is not indexed. `PRODUCT_SETTINGS_NAMESPACES` exposes that namespace to the Web client.

`@deepseek-ai/dsh-client-ui-codegraph` registers an independent settings section「代码索引」and a `conversation.input.dock` entry. The choice prompt appears only when the session is blank, the cwd is unindexed, auto-init is off, and this session has not dismissed the prompt. Auto-init or an in-flight init shows progress instead. Dismiss is a session-scoped store. Historical sessions never see the bar.

`@deepseek-ai/dsh-command-codegraph-init` registers `/codegraph-init` on the same host service. That command is a consumer only; [its Agent Note](2026-08-17-web-codegraph-init-command.md) owns the slash-command contract.

The model-facing plugin still never runs init. The agent still must not.

## Alternatives considered

**Register settings on the preset tool plugin.** Rejected: preset plugins cannot own a process-wide settings namespace.

**Use `ask_user_question` for the new-session prompt.** Rejected: that tool is model-initiated and enters the session log. This is product chrome, so it uses the existing input dock.

**Remember “never ask for this repository”.** Rejected: permanent policy is auto-init or an existing index. Dismiss stays this session only.

**Move extraTools / isolation / timeout into the settings page.** Rejected: those remain preset `Config` on the tool plugin.

**Auto-init in CLI / headless / ACP.** Rejected: those assemblies do not mount the host plugin.

## Consequences

A blank Web session on an unindexed workspace shows Initialize / Dismiss above the composer. `/codegraph-init` starts the same host job. Settings can turn on auto-init so later sessions skip the choice. Init never appears in the session log; the model notices the index only through later `codegraph_explore` results.

## Testing

Host tests cover unindexed / indexed / no cwd / autoInit on `session/created` / same-cwd dedup / failed init / dispose abort / Loader composition. Client tests cover the two-button blank prompt, dismiss, progress, non-blank hide, and the settings switch. Assembled Web snapshots cover the dock, the settings section, and `/codegraph-init` in the command menu. `PRODUCT_SETTINGS_NAMESPACES` includes `codegraph`.

## Related

- [Native CodeGraph tools](2026-08-12-flyblue-codegraph-tools.md)
- [Web `/codegraph-init` starts host-plane CodeGraph indexing](2026-08-17-web-codegraph-init-command.md)
