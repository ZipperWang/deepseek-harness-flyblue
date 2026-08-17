# @deepseek-ai/dsh-tool-codegraph

[English](README.md) | 中文

面向模型的 **CodeGraph 工具集**，基于发行版附带的 [`@colbymchenry/codegraph`](https://www.npmjs.com/package/@colbymchenry/codegraph) 引擎。本包负责工具名、JSON schema、`tool:codegraph` 提示词段、项目路径约束和 UI 呈现。引擎是本包钉死的运行时依赖；没有 `ctx.codegraph` 服务，也不走 host MCP 客户端。

命名空间插件（`name` / `inject` / `Config` / `apply`，无 default 导出）。注入 `tools` 与 `systemPrompt`。

注册不要求已有 `.codegraph/` 索引。缺少索引或引擎加载失败时，工具仍返回成功形态的指引，让模型改用 `read`/`grep`/`glob`。本插件从不执行 `codegraph init`。Web GUI 与可选的自动 init 在 `@deepseek-ai/dsh-codegraph-index`，只由用户点击或 `autoInit` 设置启动。

## 工具

| 工具 | 默认 | 参数 | 行为 |
|---|---|---|---|
| `codegraph_explore` | 是 | `query`（必填）、`maxFiles?`、`projectPath?` | 主工具。返回相关符号的逐字带行号源码，以及调用路径和影响面摘要。 |
| `codegraph_status` | `extraTools` | `projectPath?` | 索引健康检查。 |
| `codegraph_node` | `extraTools` | `symbol?`、`file?`、`projectPath?` | 单个符号或文件。 |
| `codegraph_search` | `extraTools` | `query`、`kind?`、`limit?`、`projectPath?` | 按名搜索，只返回位置。 |
| `codegraph_callers` / `codegraph_callees` / `codegraph_impact` / `codegraph_files` | `extraTools` | 见 schema | explore 已覆盖的更窄切片。 |

`projectPath` 默认为会话 workspace cwd，且必须解析到该 workspace 内。没有会话 cwd 时调用按工具错误失败。

规范值为 `{ text, projectPath, indexed }`。Native 渲染只输出 `text`。Code Mode 可直接读 `indexed`，不必解析正文。

## 配置

| 键 | 默认 | 含义 |
|---|---|---|
| `extraTools` | `[]` | 除 `explore` 外要列出的短名：`status`、`node`、`search`、`callers`、`callees`、`impact`、`files`。未知或重复 id 在加载时失败。 |
| `isolation` | `auto` | `in-process` 在本进程打开库；`subprocess` 用 `process.execPath` 跑随包 CLI；`auto` 在 Node 25 以下用进程内，在 Node 25+ 用子进程（该版本上 tree-sitter WASM 可能把宿主 OOM）。 |
| `timeoutMs` | `60000` | 工具调用超时预算，由 `dsh-tool-call-timeout-policy` 强制执行。 |

```yaml
- id: tool-codegraph
  name: '@deepseek-ai/dsh-tool-codegraph'
```

## 模型体验

### 系统提示词

#### 模型看到什么

一段系统提示词（order 108）把结构性问题导向 `codegraph_explore`。

##### 逐字指引

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

#### Token 影响

插件处于活动状态时，每次请求都有固定的指引成本。

#### KV Cache 影响

在插件作用域和指引文本不变时前缀稳定；激活或卸载可能从此段起使复用失效。

### 工具 schema

#### 模型看到什么

模型看到生成的 [`codegraph_explore` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-codegraph)，以及同一目录段中由 `extraTools` 列出的 schema。

#### Token 影响

每个已列出工具有固定 schema 成本；`timeoutMs` 和 `isolation` 不会发给模型。

#### KV Cache 影响

在可见工具定义和顺序不变时前缀稳定；`extraTools` 或插件生命周期可能从第一个变化的 schema token 起使复用失效。

### 结果

#### 模型看到什么

引擎正文（`text`）：explore 的 markdown、status 列表，或项目未建索引 / 引擎加载失败时的成功形态指引。路径逃逸和缺少 workspace 是工具错误。

#### Token 影响

依赖数据的结果会保留到压缩为止。未建索引的指引很短，并按项目路径稳定。

#### KV Cache 影响

只追加；新可见内容跟在可复用请求前缀之后，不会使已有 KV-cache 条目失效。

### UI 呈现

#### 模型看到什么

无。客户端渲染一张以 query 或 symbol 为标题的通用 search 卡片。

#### Token 影响

零直接 token 影响，因为渲染只发生在客户端。

#### KV Cache 影响

无；UI 呈现不进入模型请求。

## 已知限制与延期工作

- **每个 workspace 仍需要 `.codegraph/` 索引** — harness 附带引擎和工具，不附带每个仓库的索引。建索引是用户的决定：Web「代码索引」页、自动 init，或 `codegraph init`。Agent 仍然不得自行 init。
- **进程内 `ToolHandler` 是钉版本的内部导入** — `@colbymchenry/codegraph` 的公开入口导出 `CodeGraph` 但不导出 `ToolHandler`；本包从对应平台包的 `lib/dist/mcp/index.js` 加载 `ToolHandler`，并钉死 `1.5.0`。这些导出若移动，契约测试会失败。子进程路径运行包内的 `npm-shim.js`，由随包 Node 24 执行 CLI。
- **没有 host 平面的图缓存** — 每个已挂载 preset fiber 持有自己的只读打开。共享的 `ctx.codegraph` 服务延期。
