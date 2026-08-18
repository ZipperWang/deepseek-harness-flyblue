# @deepseek-ai/dsh-plan-handoff

[English](README.md) | 中文

按 agent（智能体）记录的 plan 协作状态：部署持有的指引、`/plan [message]` 进入、`/plan off` 退出，以及审阅后可选保留 / 压缩 / 清空上下文再执行的 `exit_plan_mode`。Plan mode 是软性指引；沙箱模式与审批策略独立强制限制。

本包在已交付组合中替换 `@deepseek-ai/dsh-plan-mode`。`ctx.planMode`、`plan/mode`、`/plan` 与 `exit_plan_mode` 名称不变。

## 持久状态

`plan/mode`（`{ active: boolean }`）是只写入日志、整值替换的 `SessionEventMap` 成员。`foldPlanMode(events)` 返回最后一条记录，没有则返回 `false`。`ctx.planMode.set` / `get` 与旧包相同：空闲时立即提交；打开的轮次等到下一个被接受的轮内 pre-step。

批准审阅还会追加 `plan/approved` `{ execution, title }`。清空交接在源会话追加 `plan/handoff` `{ childSessionId, mode: 'clear' }`。

## 审阅与执行

`exit_plan_mode` 在两种状态下都保持注册。在 plan mode 中，它要求以 `#` 标题开头的 markdown 计划，并通过 `ctx.userQuestions` 提供四个选项：

- `Approve and execute` — 源 agent 空闲后创建兄弟会话（相同 cwd、模型与 preset），挂到同一 workspace，记录 `plan/handoff`，并把完整计划 steer 进子会话。
- `Approve and compact context` — 对本会话 `compactNow`，再 steer 完整计划。取消则不 steer。失败则回退为保留上下文。
- `Approve and keep context` — 把完整计划 steer 进本会话。
- `Refine plan` — 留在 plan mode；反馈作为失败调用返回。

没有 `ctx.agents.create` 的 TUI 或其他宿主会把清空当作压缩后再执行。

Web 客户端在当前会话上看到实时 `plan/handoff` 时选中子会话；若子会话稍后才进入列表，也会在出现时选中。历史回放不会切换。

## 配置

```yaml
- id: plan-mode
  name: '@deepseek-ai/dsh-plan-handoff'
  config:
    section: |
      You are in plan mode. Explore and write a decision-complete execution spec
      through exit_plan_mode.
```

`section` 必填且非空。未知键在加载时失败。

## Model Experience

### Plan policy system prompt

#### What the model sees

Plan mode 激活时，模型在提示词顺序 50 处看到部署的精确 `section` 文本；未激活时不贡献文本。

#### Token effect

未激活不加 token；激活时每一请求都带上配置的段落。

#### KV Cache effect

该段落在 plan mode 内稳定；进入或离开会从顺序 50 起改变系统提示词。

### Exit tool and execution prompt

#### What the model sees

[`exit_plan_mode` schema](../../../docs/tool-catalog.md#deepseek-aidsh-plan-handoff) 在两种状态下都可用。批准返回 `{ approved: true, execution }` 以及按模式区分的确认文本。空闲后，一条插件来源的用户消息携带已批准计划并要求执行。

#### Token effect

稳定 schema 按 ToolRuntime 模式计费。保留上下文增加一条执行提示。压缩用摘要替换较早表层节点，再附上完整计划。清空则开启新会话，其第一条模型可见输入就是该提示。

#### KV Cache effect

模式转换不改变工具目录。压缩替换表层前缀。清空是新的会话前缀。

## Known Limitations and Deferred Work

- **清空需要会话工厂** — 没有 `ctx.agents` 时回退为压缩后执行，这是 TUI/headless 路径。
- **不落盘计划文件** — 已批准的 markdown 留在工具参数中，并复制进执行提示；没有 `local://` 产物。
- **仅软性指引** — 忽略该段落的模型仍可改动工作区；沙箱与审批需单独配置。
- **仍写 `@deepseek-ai/dsh-plan-mode` 的用户复制 preset** 在改行名之前会加载失败。
- 在一轮最后一个被接受的 pre-step 之后作出的选择，若进程在下一个被接受的轮内 pre-step 之前退出，就会丢失。
- 压缩使用通用摘要器；压缩后以 steer 进去的计划为权威来源。
