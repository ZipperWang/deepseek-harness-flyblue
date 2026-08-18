# @deepseek-ai/dsh-client-ui-workspace-inspector

[English](README.md) | 中文

用于有界检查第一个已登记工作区的浏览器设置区段。插件在 `settings.section` 中注册 `workspace-inspector`，通过 `workspaceFiles.tree()` 列出工作区根目录，并通过 `workspaceFiles.preview()` 打开文本预览。

所有路径授权、链接拒绝、预览上限和版本元数据仍由 Host 负责。区段把 RPC 失败显示为警报，并在 Host 报告截断时标记预览。

## 模型体验

无，因为该浏览器端工作区文件投影不注册模型可见内容。

#### KV Cache 影响

无；工作区浏览不参与提供方请求。

## 已知限制与暂缓事项

- 区段始终选择第一个已登记工作区，不提供工作区选择器。
- 当前文件树仅限根目录条目，不提供目录导航、搜索、编辑、重命名、创建或删除控件。
