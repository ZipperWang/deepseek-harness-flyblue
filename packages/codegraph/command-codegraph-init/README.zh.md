# @deepseek-ai/dsh-command-codegraph-init

[English](README.md) | 中文

通过 [`ctx.codegraphIndex`](../codegraph-index/README.md) 提供面向用户的 `/codegraph-init` 控制。该插件通过 [`ctx.commands`](../../interaction/commands/README.md) 注册一个全局命令，因此组合中的每个命令适配器都能发现并执行它，无需模型轮次。[Web `/codegraph-init` Agent Note](../../../.agents/notes/implemented/feature/2026-08-17-web-codegraph-init-command.md) 拥有组合与结果文本决策。

## 命令约定

| 输入 | 结果 |
|---|---|
| 未建索引的工作区上执行 `/codegraph-init` | `Started CodeGraph indexing for <path>.` — `init` 立即返回；host 任务在后台继续。 |
| 索引已存在时执行 `/codegraph-init` | `CodeGraph index is already present at <path>.` — 管理器不会再次拉起进程。 |
| 会话没有工作区时执行 `/codegraph-init` | `This session has no workspace. Open a project before initializing CodeGraph.` |
| 启动失败且未进入进行中任务后执行 `/codegraph-init` | 管理器的 `error` 行；若当前没有 error，则为 `CodeGraph index is not present at <path>.`。 |
| `/codegraph-init <anything>` | `Usage: /codegraph-init (no arguments)` — 该命令不接受参数，也不会调用管理器。 |

该命令只做消费：它对接收 agent 的会话调用 `init(session.id)`，并把返回的快照映射成直接结果。会话不在线时变为 `This session is not live.`。意外实现故障会拒绝分发。每次完成的调用都会记录执行器所属的纯日志事件对 `command/run` / `command/done`；两者都不进入模型历史。init 本身不写入会话日志。

## 组合

生产方注入 `commands` 和 `codegraphIndex`。挂载命令注册表、host 索引管理器与本插件：

```yaml
- id: commands
  name: '@deepseek-ai/dsh-commands'
- id: codegraph-index
  name: '@deepseek-ai/dsh-codegraph-index'
- id: command-codegraph-init
  name: '@deepseek-ai/dsh-command-codegraph-init'
```

随附 Web bundle 将它挂载在 `codegraph-index` 旁。CLI、headless 与 ACP 组装不挂索引管理器，因此不会注册该命令。

## 模型体验

### 用户 `/codegraph-init` 控制

#### 模型看到什么

斜杠输入与直接结果绝不会进入模型请求。创建 `.codegraph/` 只通过之后的 `codegraph_explore` 结果对模型可见。

#### Token 影响

命令生命周期不会增加模型 token。

#### KV Cache 影响

命令发现与簿记不会影响缓存。之后一次成功的 explore 结果是独立的模型请求。

## 已知限制与延期工作

- **立即返回** — 命令只报告索引已开始；它不等待 `indexed` 或 `error`。进度仍在 Web「代码索引」页和空白会话提示条上。
- **仅 Web host** — 没有 `ctx.codegraphIndex` 的接口不会注册该命令。CLI 与 headless 用户仍需自行运行 `codegraph init`。
- **不接受路径参数** — 管理器始终为 `session.header.cwd` 建索引。
