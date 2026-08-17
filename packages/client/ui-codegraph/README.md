# @deepseek-ai/dsh-client-ui-codegraph

English | [中文](README.zh.md)

Web GUI for CodeGraph index lifecycle. The plugin registers a `settings.section` named「代码索引」and a `conversation.input.dock` entry `codegraph-index`.

The settings page reads and writes `codegraph.autoInit` through `ctx.settingsScope`, shows the current session cwd status, and can start init. The dock prompt appears only on a blank session whose cwd is not indexed, auto-init is off, and the user has not dismissed this session. Initialize calls `codegraphIndex.init`; dismiss is a session-scoped store. While init runs, the dock shows progress. Historical sessions never see the prompt.

The host `@deepseek-ai/dsh-codegraph-index` service owns status, spawn, and auto-init. This package never writes the session log.

## Model Experience

None, as this browser plugin registers no model-facing prompt, schema, or session event.

#### KV Cache effect

None; the dock and settings page never enter the model request.

## Known Limitations and Deferred Work

- **Dismiss is this session only** — the next blank session for the same repository asks again. Permanent silence is auto-init or an existing `.codegraph/` index.
- **Web GUI only** — CLI and headless users still run `codegraph init` themselves.
