# @deepseek-ai/dsh-tool-codegraph

English | [中文](README.zh.md)

The model-facing **CodeGraph tool suite** over the bundled [`@colbymchenry/codegraph`](https://www.npmjs.com/package/@colbymchenry/codegraph) engine. It owns tool names, JSON schemas, the `tool:codegraph` prompt section, project-path confinement, and UI presentation. The engine is a pinned runtime dependency of this package; there is no `ctx.codegraph` service and no host MCP client.

Namespace plugin (`name` / `inject` / `Config` / `apply`, no default export). Injects `tools` and `systemPrompt`.

Registration does not require a `.codegraph/` index. A missing index or a failed engine load stays a successful tool result that tells the model to use `read`/`grep`/`glob`. The plugin never runs `codegraph init`. The Web GUI and optional auto-init live in `@deepseek-ai/dsh-codegraph-index` and start only from a user click or the `autoInit` setting.

## Tools

| Tool | Default | Args | Behavior |
|---|---|---|---|
| `codegraph_explore` | yes | `query` (required), `maxFiles?`, `projectPath?` | Primary tool. Returns verbatim line-numbered source for the relevant symbols, plus call paths and a blast-radius summary. |
| `codegraph_status` | `extraTools` | `projectPath?` | Index health. |
| `codegraph_node` | `extraTools` | `symbol?`, `file?`, `projectPath?` | One symbol or file. |
| `codegraph_search` | `extraTools` | `query`, `kind?`, `limit?`, `projectPath?` | Name search, locations only. |
| `codegraph_callers` / `codegraph_callees` / `codegraph_impact` / `codegraph_files` | `extraTools` | see schema | Narrower slices of what explore already returns. |

`projectPath` defaults to the session workspace cwd and must resolve inside that workspace. Absence of a session cwd fails as a tool error.

The canonical value is `{ text, projectPath, indexed }`. Native rendering is `text` only. Code Mode can read `indexed` without parsing the body.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `extraTools` | `[]` | Extra short names to list: `status`, `node`, `search`, `callers`, `callees`, `impact`, `files`. Unknown or duplicate ids fail at load. |
| `isolation` | `auto` | `in-process` opens the library in this process; `subprocess` runs the bundled CLI under `process.execPath`; `auto` uses in-process below Node 25 and subprocess at Node 25+, where tree-sitter WASM can OOM the host. |
| `timeoutMs` | `60000` | Tool-call timeout budget, enforced by `dsh-tool-call-timeout-policy`. |

```yaml
- id: tool-codegraph
  name: '@deepseek-ai/dsh-tool-codegraph'
```

## Model Experience

### System prompt

#### What the model sees

One system-prompt section (order 108) steers structural questions to `codegraph_explore`.

##### Verbatim guidance

```markdown
Codegraph is a local SQLite knowledge graph of symbols, edges, and files in the workspace. Use it BEFORE and while editing indexed source — one call returns verbatim line-numbered source plus call paths and blast radius.

## One tool: codegraph_explore — use it instead of reading files

`codegraph_explore` is Read-equivalent. Pass a natural-language question or a bag of symbol/file names. It returns the verbatim source of the relevant symbols grouped by file (the same `<n>\t<line>` shape `read` gives you, safe to `edit` from), plus the call path among them (including dynamic-dispatch hops grep cannot follow) and a blast-radius summary.

Call `codegraph_explore` before `read` or `grep` on indexed code. One call usually answers the question. Do not reconstruct a flow by hand and do not re-verify codegraph results with grep.

## How to query

- Almost any question — how X works, architecture, a bug, where/what is X, or surveying an area — `codegraph_explore` with the relevant names or a short question.
- How X reaches Y — name the symbols that span the flow in one query.
- Reading or editing a file/symbol you can name — put that name or path in the query.
- Need more? Call `codegraph_explore` again with more specific names and treat the returned source as already read.

## Limitations

- If a result says the project is not indexed (no `.codegraph/`), stop calling codegraph tools for that project for the rest of the session and use `read`/`grep`/`glob` there instead. Indexing is the user's decision — mention they can run `codegraph init` if it comes up, but do not run it yourself.
- The index lags file writes by about one second.
- Cross-file resolution is best-effort name matching; ambiguous calls may return multiple candidates.
- Reserve `read`/`grep` for configs, docs, or a specific detail codegraph did not cover.
```

#### Token effect

Fixed guidance cost on every request while the plugin is active.

#### KV Cache effect

Prefix-stable while the plugin scope and guidance text are unchanged; activation or disposal may invalidate reuse from this section.

### Tool schemas

#### What the model sees

The model sees the generated [`codegraph_explore` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-codegraph) and any `extraTools` schemas from the same catalog section.

#### Token effect

Fixed schema cost per listed tool; `timeoutMs` and `isolation` are never sent to the model.

#### KV Cache effect

Prefix-stable while the visible tool definition and order are unchanged; `extraTools` or plugin lifecycle may invalidate reuse from the first changed schema token.

### Results

#### What the model sees

The engine body (`text`): explore markdown, a status listing, or success-shaped guidance when the project is not indexed or the engine failed to load. Path-escape and missing-workspace failures are tool errors.

#### Token effect

Data-dependent results are resent until compaction. Unindexed guidance is short and stable per project path.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

### UI presentation

#### What the model sees

Nothing. The client renders a generic search card titled by the query or symbol.

#### Token effect

Zero direct token effect because rendering is client-side only.

#### KV Cache effect

None; UI presentation is outside the model request.

## Known Limitations and Deferred Work

- **Each workspace still needs a `.codegraph/` index** — the harness ships the engine and the tools, not a per-repo index. Creating the index is the user's decision: the Web「代码索引」page, auto-init, or `codegraph init`. The agent still must not run init.
- **In-process `ToolHandler` is a version-pinned internal import** — `@colbymchenry/codegraph`'s public entry exports `CodeGraph` but not `ToolHandler`; this package loads `ToolHandler` from the matching platform bundle (`lib/dist/mcp/index.js`) and pins `1.5.0`. A contract test fails if those exports move. The subprocess path runs the package's `npm-shim.js` so the bundled Node 24 executes the CLI.
- **No host-plane graph cache** — each mounted preset fiber holds its own read-only opens. A later shared `ctx.codegraph` service is deferred.
