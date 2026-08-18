# @deepseek-ai/dsh-client-ui-git-graph

[English](README.md) | 中文

浏览器设置区段，显示第一个已登记工作区的 Git 状态和提交历史。插件在 `settings.section` 中注册 `git-graph`，通过生成的 remote 读取 `workspaceGit.status()` 和 `workspaceGit.graph()`，并把 RPC 失败渲染为警报。

该区段是只读客户端投影。工作区身份来自共享工作区数据源，Git 访问和安全仍由 Host 上的 `@deepseek-ai/dsh-workspace-git` 负责。

## 模型体验

无，因为该浏览器端 Git 投影不注册模型可见内容。

#### KV Cache 影响

无；渲染 Git 状态和历史不参与提供方请求。

## 已知限制与暂缓事项

- 区段始终选择第一个已登记工作区，不提供工作区选择器。
- 当前 UI 只显示状态和历史；Host 服务公开的分支和索引变更尚未呈现。
