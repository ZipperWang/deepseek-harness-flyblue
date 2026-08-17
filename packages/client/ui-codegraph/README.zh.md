# @deepseek-ai/dsh-client-ui-codegraph

[English](README.md) | 中文

CodeGraph 索引生命周期的 Web GUI。插件注册名为「代码索引」的 `settings.section`，以及 `conversation.input.dock` 条目 `codegraph-index`。

设置页通过 `ctx.settingsScope` 读写 `codegraph.autoInit`，显示当前会话 cwd 的索引状态，并可立即初始化。提示条只出现在空白会话：cwd 尚未索引、自动 init 关闭、且本会话尚未点「忽略」。初始化调用 `codegraphIndex.init`；忽略记在会话作用域 store。init 进行中时条显示进度。打开已有历史会话不会出现提示条。

host 的 `@deepseek-ai/dsh-codegraph-index` 服务负责状态、进程和自动 init。本包从不写入会话日志。

## 模型体验

无，因为本浏览器插件不注册面向模型的提示词、schema 或会话事件。

#### KV Cache 影响

无；提示条和设置页不进入模型请求。

## 已知限制与延期工作

- **「忽略」只对当前会话生效** — 同一仓库的下一次空白会话仍会再问。要永久不再问，请打开自动 init，或先把 `.codegraph/` 建好。
- **仅 Web GUI** — CLI 与 headless 用户仍需自行运行 `codegraph init`。
