# @deepseek-ai/dsh-workspace-git

[English](README.md) | 中文

按已登记工作区 ID 限定范围的 Git 操作 loopback Typert 服务。它公开 porcelain 状态、本地分支、有界提交图、分支创建和切换，以及受保护的暂存、取消暂存和丢弃操作，同时不暴露任意进程执行。

切换分支要求工作树干净、不存在进行中的 merge、rebase、cherry-pick 或 revert、目标是已知本地分支，并且没有其他 worktree 冲突签出。文件操作会拒绝空路径、形似选项的路径、父目录穿越和 `.git` 路径；丢弃还要求明确确认。

## 配置

| Key | 默认值 | 含义 |
| --- | --- | --- |
| `timeoutMs` | `20000` | 单个 Git 子进程的最长运行时间。 |
| `graphLimit` | `500` | 单次提交图请求返回的最大提交数。 |

## 模型体验

无，因为该 loopback Git 服务只响应浏览器请求，不注册模型可见内容。

#### KV Cache 影响

无；工作区 Git RPC 不组装或发送模型请求。

## 已知限制与暂缓事项

- 分支 API 只覆盖本地分支；fetch、pull、push、远端配置、tag 和冲突解决均不属于该服务。
- 除可配置超时和提交图行数上限外，每个 Git 子进程还有固定的 4 MiB 输出缓冲区。
