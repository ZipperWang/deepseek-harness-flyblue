# Agent Note: FlyBlue ships native CodeGraph tools in the three full presets

Status: implemented

English | [中文](2026-08-12-flyblue-codegraph-tools.zh.md)

## Problem

A coding agent in this fork still discovers structure with `grep` / `glob` / `read`. CodeGraph already builds a local symbol graph and answers those questions in one call, but DeepSeek Harness had no first-class tool for it. Wiring the upstream MCP server through `dsh-mcp-client` would expose `mcp__codegraph__codegraph_explore`, drop CodeGraph's initialize instructions (the client bridges tools only), and fail to teach the model to stop crawling files.

## Decision

`@deepseek-ai/dsh-tool-codegraph` is a preset-plane consumer in `packages/codegraph/tool-codegraph`. It registers native `codegraph_explore` (plus optional extras) on `ctx.tools` and a `tool:codegraph` system-prompt section. It publishes no service, so the row sits loose in `standard`, `code`, and `cordis` the same way `tool-web` does. `minimal` does not load it.

The engine is a pinned npm dependency `@colbymchenry/codegraph@1.5.0`, not a PATH CLI and not a `link:` to a local checkout. `apply()` always succeeds: a missing `.codegraph/` index or a failed engine load returns success-shaped guidance. The plugin never runs `codegraph init`.

In-process dispatch uses `CodeGraph.open({ readOnly: true })` and `ToolHandler` from the package's `dist/mcp/index.js` (the public entry does not re-export `ToolHandler`). `isolation: auto` switches to the bundled CLI under `process.execPath` on Node 25+, where tree-sitter WASM can OOM the host. `projectPath` must resolve inside the session workspace cwd.

## Alternatives considered

**MCP client row in the three presets.** Rejected: ugly public names, no initialize prompt (so the agent keeps grepping), and three standing mounts would spawn three servers.

**PATH-only CLI wrapper.** Rejected: the FlyBlue distribution is supposed to ship the engine.

**Host-plane `ctx.codegraph` service.** Deferred: a consumer-only plugin avoids realm collisions and is enough for one read-only open cache per preset fiber.

**Auto `codegraph init` from the agent.** Rejected: CodeGraph treats indexing as a user decision; an early `isError` or a surprise index teaches the wrong habit.

## Consequences

New sessions on 标准 / PTC / 创造 see `codegraph_explore`. PTC Code Mode gets `tools.codegraph_explore` from the same schema. Users still run `codegraph init` once per repo. Upgrading CodeGraph is a deliberate pin bump plus the contract test that `ToolHandler` / `isInitialized` still resolve.

## Testing

`packages/codegraph/tool-codegraph/tests/` covers path confinement, isolation, both drivers, extra-tool config, Loader composition, the real-load-path namespace guard, and the pinned-package contract. Explore execution is tested against an injected driver so CI does not parse a real repo.

## Related

- [Tool authoring](../../../../docs/cookbook/adding-a-tool.md)
- CodeGraph MCP instructions live in the upstream `src/mcp/server-instructions.ts`; this package owns the DSH rewrite in `src/prompt.ts`.
