# @deepseek-ai/dsh-tool-codegraph

English | [中文](README.zh.md)

The model-facing **CodeGraph tool suite** over the bundled [`@colbymchenry/codegraph`](https://www.npmjs.com/package/@colbymchenry/codegraph) engine. It owns tool names, JSON schemas, the `tool:codegraph` prompt section, project-path confinement, and UI presentation. The engine is a pinned runtime dependency of this package; there is no `ctx.codegraph` service and no host MCP client.

Namespace plugin (`name` / `inject` / `Config` / `apply`, no default export). Injects `tools` and `systemPrompt`.

Registration does not require a `.codegraph/` index. A missing index or a failed engine load stays a successful tool result that tells the model to use `read`/`grep`/`glob`. The plugin never runs `codegraph init`. The Web GUI and optional auto-init live in `@deepseek-ai/dsh-codegraph-index` and start only from a user click, `/codegraph-init`, or the `autoInit` setting.

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

One system-prompt section (order 108) steers unique-identifier queries and forbids open prose, a lone path, and existence checks.

##### Verbatim guidance

```markdown
Codegraph is a local SQLite symbol graph. Call `codegraph_explore` first on indexed source. Shown source is Read-equivalent (`<n>\t<line>`), safe to `edit` — do not re-read those files or re-verify a clean hit with grep.

## Query
- Unique identifiers: `AuthService loginUser`, not "how does auth work".
- How X reaches Y: both unique names in one query (`AuthService markSession`).
- Need more: call again with names from the hit; treat that source as already read.
- Pass `maxFiles` when you already know the file and want a small dump.

## Do not
- Open prose, a lone file path, or "does X exist" — those token-match (a path `driver.ts` hits every `drive`; a fake name still returns `exists` / `Symbol`).
- A common verb alone (`run`, `init`, `index`) — pair it with a rare companion name.
- Reconstruct a flow by hand when the call path already names the hops.

## Fallback
- No `.codegraph/`: stop codegraph tools for this project; use read/grep/glob. Indexing is the user's decision (`codegraph init`); do not run it.
- Use read/grep for configs, docs, and when the hit is token soup (unrelated files, Map methods, helpers). Source text is live from disk; blast-radius line numbers can lag a just-saved file by about one second.
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

- **Each workspace still needs a `.codegraph/` index** — the harness ships the engine and the tools, not a per-repo index. Creating the index is the user's decision: the Web「代码索引」page, `/codegraph-init`, auto-init, or `codegraph init`. The agent still must not run init.
- **Explore token-matches the query** — open prose, a lone path, and negative lookups fail open. The `tool:codegraph` prompt is the query contract; extras stay off by default because they duplicate explore and spend schema tokens.
- **In-process `ToolHandler` is a version-pinned internal import** — `@colbymchenry/codegraph`'s public entry exports `CodeGraph` but not `ToolHandler`; this package loads `ToolHandler` from the matching platform bundle (`lib/dist/mcp/index.js`) and pins `1.5.0`. A contract test fails if those exports move. The subprocess path runs the package's `npm-shim.js` so the bundled Node 24 executes the CLI.
- **No host-plane graph cache** — each mounted preset fiber holds its own read-only opens. A later shared `ctx.codegraph` service is deferred.
