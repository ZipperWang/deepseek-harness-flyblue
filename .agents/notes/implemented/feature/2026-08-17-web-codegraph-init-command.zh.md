# Agent Note：Web `/codegraph-init` 启动 host 平面 CodeGraph 索引

Status: implemented

[English](2026-08-17-web-codegraph-init-command.md) | 中文

## 问题

Web 用户可以从空白会话提示条或**设置 → 代码索引**启动 CodeGraph 索引，但斜杠命令目录里没有对应项。已经习惯 `/compact` 和 `/export` 的用户必须离开输入框。若把 init 挂在 `@deepseek-ai/dsh-tool-codegraph` 上，模型就能启动索引，这与[索引管理器笔记](2026-08-13-web-codegraph-index-manager.md)的禁令冲突。

## 决策

`@deepseek-ai/dsh-command-codegraph-init` 是 `ctx.codegraphIndex` 的 host 平面命令消费方。它注册无参数的 `/codegraph-init`。处理器对接收 agent 调用 `init(session.id)`，并把返回的快照映射成直接结果。`init` 仍然立即返回；命令不轮询。Web bundle 将插件挂在 `codegraph-index` 旁。CLI、headless 与 ACP 组装两者都不挂。

结果文本稳定且为英文：

| 快照 | 直接结果 |
|---|---|
| `projectPath === null` | `This session has no workspace. Open a project before initializing CodeGraph.` |
| `indexed` | `CodeGraph index is already present at <path>.` |
| `indexing` | `Started CodeGraph indexing for <path>.` |
| 遗留 `error` | 管理器的 error 行 |
| 未索引、空闲、无 error | `CodeGraph index is not present at <path>.` |
| 额外参数 | `Usage: /codegraph-init (no arguments)` |
| 会话不在线 | `This session is not live.` |

执行器记录 `command/run` / `command/done`。init 本身仍然不进入会话日志。面向模型的工具插件仍然从不执行 init。

## 考虑过的替代方案

**等到 `indexed` 或 `error`。** 否决：建索引可能耗时数分钟，管理器按设计立即返回。进度已经在设置页和提示条上。

**在每个 preset 里注册该命令。** 否决：`codegraphIndex` 是 host 服务。preset 行在 CLI 上会永远等待，在 Web 上也挂错平面。

**让命令自己 spawn `codegraph init`。** 否决：那会重复索引管理器已经拥有的任务去重、dispose 中止和 cwd 约束。

**给 `/codegraph-init` 路径参数。** 否决：管理器始终为 `session.header.cwd` 建索引，客户端不能另指定根目录。

## 后果

Web 命令菜单列出 `/codegraph-init`。输入它会启动与提示条和设置页相同的 host 任务。CLI 与 headless 用户仍需自行运行 `codegraph init`。Agent 仍然不得自行 init。

## 测试

包测试覆盖注册、处置、每种快照映射、参数拒绝、会话不在线、意外拒绝，以及真实 Loader 组装。组装后的 Web 命令菜单快照把新描述符列在第一位。

## 相关

- [Web host 负责 CodeGraph 索引 init](2026-08-13-web-codegraph-index-manager.md)
- [插件拥有的人类命令注册](2026-07-19-plugin-command-registration.md)
