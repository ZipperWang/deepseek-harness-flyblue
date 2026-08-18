# Agent Note: 审阅后的计划交接

Status: implemented

[English](2026-08-19-plan-handoff.md) | 中文

## Problem

已交付的 plan mode 在 `Approve` 之后仍保留整段规划对话。长探索会把执行者埋进工具噪声，随后的压缩还可能丢掉计划本应带走的决策。OMP 把计划当成 execution spec，并让操作者选择保留、压缩或新会话。DSH 已经拒绝计划落盘和写拦截；这些约束仍然成立。

## Decision

`@deepseek-ai/dsh-plan-handoff` 是已交付的 plan 插件。它保留 `ctx.planMode`、`plan/mode`、`/plan` 和 `exit_plan_mode`。审阅提供三个离开标签——`Approve and execute`、`Approve and compact context`、`Approve and keep context`——外加 `Refine plan`。`plan-review` 的 `AskUserQuestionIntent` 用 `approve: string[]` 点名这些离开标签。Web 卡片渲染每条批准路径和 refine；通用问题流仍是回退。

源 agent 空闲后，保留上下文会把完整计划 steer 进本会话；压缩会先 `compactNow` 再 steer（取消则不 steer；失败则保留上下文）；清空会创建相同 cwd、模型和 preset 的兄弟会话，在源会话记录 `plan/handoff`，并把计划 steer 进子会话。没有 `ctx.agents.create` 的宿主把清空当作压缩后再执行。Web 的 `SessionManager` 在当前会话上看到实时 `plan/handoff` 时选中子会话，或在该子会话稍后进入列表时选中。`plan/mode`、`plan/handoff` 和 `plan/approved` 声明在包的 `types`/`client` 面上，这样导入该出口的 Client 程序能在 `SessionEventMap` 上看到它们。

计划 markdown 留在工具参数中，并复制进执行提示。没有计划文件，也没有写拦截。

## Alternatives considered

**就地演进 `@deepseek-ai/dsh-plan-mode`。** 否决：要求的交付物是替换插件。旧包已删除；已交付组合挂载 `dsh-plan-handoff`。

**用同会话表层替换表示清空。** 否决：选定的产品含义是新会话，对齐 OMP 的 approve-and-execute。

**在 plan mode 里硬拦写入。** 否决：plan mode 仍是指引；沙箱和审批仍是强制轴。

**把计划落到 `local://`。** 否决：既有协作状态说明已经拒绝第二家持久化。执行提示就是模型可见的副本。

## Consequences

批准不再只是「在这里继续」。压缩和清空依赖会话工厂或压缩服务；没有它们时插件降级而不是闭死。审阅卡不再是二元，因此[把计划审阅当成决策](2026-07-30-plan-review-presentation-intent.md)现在点名一组批准标签。[计划专属协作状态](../simplification/2026-07-22-plan-specific-collaboration-state.md)里的软指引和只写入日志的 `plan/mode` 折叠仍然成立。

## Testing

包测试覆盖原先的 plan-mode 状态机，以及 keep/compact/clear 空闲交接、压缩取消、无工厂时的清空回退。`user-questions` 与 `ui-user-questions` 钉住 `approve: string[]` 和四按钮卡片。`SessionManager` 在实时 `plan/handoff` 之后选中已列入的子会话。
