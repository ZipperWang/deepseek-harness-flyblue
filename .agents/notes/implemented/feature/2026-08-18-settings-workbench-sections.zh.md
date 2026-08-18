# Agent Note: Settings workbench sections — tokenized presentation and existing remotes

Status: implemented

[English](2026-08-18-settings-workbench-sections.md) | 中文

## Problem

设置弹窗中的 Git 图谱、任务看板、SSH 运维和文件检查器区段渲染的是无样式 HTML 列表与表单。它们未使用 `--dsw-*` token 体系，没有加载或空态，并且即使区段 intro 已经点名这些操作（分支操作、主机配置、任务变更），也没有用上 Host remote。

## Decision

每个区段仍在原有包中作为 `settings.section` 注册项。呈现使用 CSS Module 与 `--dsw-alias-*` / `--dsw-shadow-*` / `--ds-*` token、`Button`/`Input`/`Pill`/`TerminalBlock` primitive 以及现有图标集。动效使用 `--ds-ease-in-out`，并带 `prefers-reduced-motion` 守卫。inject 面只暴露 Host 已经发布的 remote；不改任何 Host 包。

Git 图谱（`ui-git-graph`）通过 `statusMeta` 分类 porcelain 双码，通过 `assignLanes` 分配提交泳道，并提供暂存、取消暂存、二次确认丢弃、切换与新建分支。任务看板（`ui-task-board`）拆分进行中/已归档页签，乐观应用归档/创建/重命名/删除，再重新加载账本，使 Host 列表保持权威。SSH（`ui-ssh`）通过 `put` 新增和编辑主机、通过 `remove` 删除，并通过 `exec` 为每条命令追加一个 `TerminalBlock`；分发后中断保留部分输出和结果未知警告。文件检查器（`ui-workspace-inspector`）保持只读：面包屑 `tree(path)`、防抖 `search`，以及带大小、版本令牌和截断标记的预览栏。

每次 Remote 批次都带请求序号，过期响应不能覆盖更新的数据。导航文案和 `order` 仍为 `41–44`。

## Alternatives considered

- **只做视觉刷新，inject 面不变。** 区段 intro 已经点名分支操作、主机配置和任务调度；继续闲置这些 remote 会留下请求里指出的「缺乏细节」。
- **在检查器中提供文件创建/重命名/保存/删除。** Host remote 已存在，但设置弹窗不是编辑器；确认流和过期写入校验不属于这个只读检查页。
- **新增主题动效 token。** `--ds-ease-in-out` 和 `--ds-transition-duration*` 已经表达非线性曲线；改主题会扩大影响面且不增加新契约。
- **抽出共享的 settings-section 工具包。** 四个区段共享的是 token 和 primitive，不是第三层抽象；现在抽包会在没有第二类消费者的情况下发明一个所有者。

## Consequences

四个包现在依赖 `@deepseek-ai/dsh-client-ui-primitives`（平台模块），并在 per-file 覆盖率门禁下携带 apply / section / styles 测试。破坏性的 Git 丢弃、已归档任务删除和 SSH 主机删除保持两步确认。检查器仍投影第一个已登记工作区。settings-chrome 快照仍停在通用设置页，不固定这四个页面。
