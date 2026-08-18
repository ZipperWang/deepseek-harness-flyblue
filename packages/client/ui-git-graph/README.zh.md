# @deepseek-ai/dsh-client-ui-git-graph

[English](README.md) | 中文

浏览器设置区段，显示第一个已登记工作区的 Git 工作树、分支和提交图谱。插件在 `settings.section` 中注册 `git-graph`，通过生成的 remote 读取 `workspaceGit.status()`、`workspaceGit.graph()` 和 `workspaceGit.branches()`，按已暂存/未暂存/未跟踪/冲突分类呈现变更，并提供暂存、取消暂存和二次确认的丢弃操作。分支卡片可以切换本地分支，并在当前 HEAD 上新建分支。

该区段是纯展示客户端投影：工作区身份来自共享工作区数据源，Git 访问和安全仍由 Host 上的 `@deepseek-ai/dsh-workspace-git` 负责，RPC 失败渲染为带重试的警报横幅。

## 模型体验

无，因为该浏览器端 Git 投影不注册模型可见内容。

#### KV Cache 影响

无；渲染 Git 状态和历史不参与提供方请求。

## 已知限制与暂缓事项

- 区段始终选择第一个已登记工作区，不提供工作区选择器。
- 提交图谱渲染泳道与合并主干，不绘制水平连接曲线。
