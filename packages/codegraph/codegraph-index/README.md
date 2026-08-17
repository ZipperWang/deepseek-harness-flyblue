# @deepseek-ai/dsh-codegraph-index

English | [中文](README.zh.md)

Host-plane CodeGraph index lifecycle for the Web GUI. `ctx.codegraphIndex` exposes `status(sessionId)` and `init(sessionId)`. Both methods read `session.header.cwd` on the host and ignore any client-supplied path. `init` starts `codegraph init` and returns immediately; the UI polls `status` until `indexed` or `error`. The same resolved cwd shares one in-flight job. Disposing the service fiber aborts unfinished spawns.

The `codegraph` settings namespace holds `{ autoInit: boolean }` (default `false`). When `autoInit` is true, `session/created` starts init for a session that has a cwd and is not already indexed. CLI, headless, and ACP assemblies do not mount this plugin, so they never auto-init.

The model-facing `@deepseek-ai/dsh-tool-codegraph` plugin still never runs init. Only a user click or this host auto-init path creates `.codegraph/`.

```yaml
- id: codegraph-index
  name: '@deepseek-ai/dsh-codegraph-index'
```

## Service contract

`status` and `init` require a live session. A missing cwd returns `{ projectPath: null, indexed: false, indexing: false }` and does not spawn. A failed engine probe or a non-zero init exit sets `error` to a readable stderr/stdout line; the caller may retry. Init is not written to the session log.

## Model Experience

Indirectly, through the model-facing tools in dsh-tool-codegraph.

#### KV Cache effect

None; this package never writes session events or prompt sections.

## Known Limitations and Deferred Work

- **Web host only** — CLI and headless users still run `codegraph init` themselves. Auto-init is absent unless this plugin is mounted.
- **Ignore is not stored here** — dismissing the new-session prompt is a client-session fact. Permanent silence is auto-init or an existing index.
