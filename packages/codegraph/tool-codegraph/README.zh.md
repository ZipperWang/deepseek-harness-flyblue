# @deepseek-ai/dsh-tool-codegraph

[English](README.md) | 中文

面向模型的 **CodeGraph 工具集**，基于发行版附带的 [`@colbymchenry/codegraph`](https://www.npmjs.com/package/@colbymchenry/codegraph) 引擎。本包负责工具名、JSON schema、`tool:codegraph` 提示词段、项目路径约束和 UI 呈现。引擎是本包钉死的运行时依赖；没有 `ctx.codegraph` 服务，也不走 host MCP 客户端。

命名空间插件（`name` / `inject` / `Config` / `apply`，无 default 导出）。注入 `tools` 与 `systemPrompt`。

注册不要求已有 `.codegraph/` 索引。缺少索引或引擎加载失败时，工具仍返回成功形态的指引，让模型改用 `read`/`grep`/`glob`。本插件从不执行 `codegraph init`。Web GUI 与可选的自动 init 在 `@deepseek-ai/dsh-codegraph-index`，只由用户点击、`/codegraph-init` 或 `autoInit` 设置启动。

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

一段系统提示词（order 108）要求用唯一标识符查询，并禁止开放式自然语言、单独路径和存在性探查。

##### 逐字指引

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

- **每个 workspace 仍需要 `.codegraph/` 索引** — harness 附带引擎和工具，不附带每个仓库的索引。建索引是用户的决定：Web「代码索引」页、`/codegraph-init`、自动 init，或 `codegraph init`。Agent 仍然不得自行 init。
- **Explore 按 token 匹配查询** — 开放散文、单独路径和负例探查会 fail-open。`tool:codegraph` 提示词就是查询约定；默认不开 extras，因为它们重复 explore 且消耗 schema token。
- **进程内 `ToolHandler` 是钉版本的内部导入** — `@colbymchenry/codegraph` 的公开入口导出 `CodeGraph` 但不导出 `ToolHandler`；本包从对应平台包的 `lib/dist/mcp/index.js` 加载 `ToolHandler`，并钉死 `1.5.0`。这些导出若移动，契约测试会失败。子进程路径运行包内的 `npm-shim.js`，由随包 Node 24 执行 CLI。
- **没有 host 平面的图缓存** — 每个已挂载 preset fiber 持有自己的只读打开。共享的 `ctx.codegraph` 服务延期。
