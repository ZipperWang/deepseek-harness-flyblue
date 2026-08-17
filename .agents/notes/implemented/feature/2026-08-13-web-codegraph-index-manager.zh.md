# Agent Note：Web host 负责 CodeGraph 索引 init

Status: implemented

[English](2026-08-13-web-codegraph-index-manager.md) | 中文

## 问题

未建索引的 workspace 上，新建 Web 会话只能等模型调用 `codegraph_explore` 之后才知道没有索引。没有产品提示条，没有设置页，也不能在 GUI 里启动 `codegraph init`，只能自己在终端跑。若把设置或会话提示挂在 `@deepseek-ai/dsh-tool-codegraph` 上，preset 插件会注册 settings namespace。同一 preset 可被多个会话挂载，重复注册会失败。

## 决策

索引生命周期是 host 平面服务 `@deepseek-ai/dsh-codegraph-index`（`ctx.codegraphIndex`）。Web bundle 在任何会话创建之前就挂上它。Remote 方法是 `status(sessionId)` 与 `init(sessionId)`。两者都读 host 上的 `session.header.cwd`。`init` 立即返回；UI 轮询 `status`。同一规范化 cwd 共享一个进行中的 spawn。fiber dispose 会中止未完成的任务。

`codegraph` 设置命名空间是 `{ autoInit: boolean }`，默认 `false`。为 true 时，`session/created` 会对带 cwd、尚未索引的会话启动 init。`PRODUCT_SETTINGS_NAMESPACES` 把该命名空间暴露给 Web 客户端。

`@deepseek-ai/dsh-client-ui-codegraph` 注册独立的设置页「代码索引」和 `conversation.input.dock` 条目。选择提示只在会话空白、cwd 未索引、自动 init 关闭、且本会话尚未忽略时出现。自动 init 或正在进行的 init 会改为显示进度。忽略记在会话作用域 store。打开已有历史会话不会出现该条。

`@deepseek-ai/dsh-command-codegraph-init` 在同一 host 服务上注册 `/codegraph-init`。该命令只做消费；[其 Agent Note](2026-08-17-web-codegraph-init-command.md) 拥有斜杠命令约定。

面向模型的插件仍然从不执行 init。Agent 仍然不得自行 init。

## 考虑过的替代方案

**在 preset 工具插件上注册设置。** 否决：preset 插件不能拥有进程级 settings namespace。

**用 `ask_user_question` 做新建会话提示。** 否决：该工具由模型发起并进入会话日志。这是产品提示，走已有的输入区 dock。

**记住「这个仓库永远别问」。** 否决：永久策略是自动 init，或先把索引建好。忽略只对当前会话生效。

**把 extraTools / isolation / timeout 搬进设置页。** 否决：那些仍是工具插件的 preset `Config`。

**在 CLI / headless / ACP 里自动 init。** 否决：那些组装不挂这个 host 插件。

## 后果

未索引 workspace 上的空白 Web 会话会在输入区上方看到「初始化 / 忽略」。`/codegraph-init` 会启动同一 host 任务。设置里打开自动 init 后，之后的新会话不再选择。init 不写入会话日志；模型只在之后的 `codegraph_explore` 结果里感知索引是否存在。

## 测试

Host 测试覆盖未索引 / 已索引 / 无 cwd / autoInit 在 `session/created` 启动 / 同 cwd 去重 / init 失败 / dispose abort / Loader 组装。Client 测试覆盖空白未索引的两个按钮、忽略、进度、非空白不显示、以及设置开关。组装后的 Web 快照覆盖提示条、设置页，以及命令菜单中的 `/codegraph-init`。`PRODUCT_SETTINGS_NAMESPACES` 包含 `codegraph`。

## 相关

- [原生 CodeGraph 工具](2026-08-12-flyblue-codegraph-tools.md)
- [Web `/codegraph-init` 启动 host 平面 CodeGraph 索引](2026-08-17-web-codegraph-init-command.md)
