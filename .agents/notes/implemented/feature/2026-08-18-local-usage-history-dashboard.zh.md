# Agent Note: 从会话日志派生本机用量历史

Status: implemented

[English](2026-08-18-local-usage-history-dashboard.md) | 中文

## Problem

进程内计数器无法回答这台设备过去的使用情况：它会丢失冷会话和已归档会话，重复累计早期与最终 usage 样本，还会暗示 Harness 无法证实的余额等账户信息。按 Workspace 统计也会遗漏未归属 Workspace 的有效本机会话。

## Decision

`@deepseek-ai/dsh-usage-stats` 从持久会话词汇派生历史。服务合并实时 `sessions.list()` 与 `sessionPersistence.listSnapshots()`，按 Session ID 去重，优先读取实时会话的不可变事件切面，只 inspect 冷日志。缓存按对象身份和 seq 推进实时投影，按持久化 revision 使冷投影失效。冷读取具有可配置并发上限。存储错误会使请求失败，不返回局部总量。

统计遵循 token-meter 的替换语义。请求失败后 usage chunk 仍保留，同一 turn/step 的最终样本会替换它。chunk 按当前 request header 归属，最终助手消息可以更新路由。Token 总量只包含四个互斥计费桶，reasoning 始终是 output 的子集。活跃数据只统计直接用户消息和非空助手消息。

Web 呈现保留在“设置 → 用量统计”。默认展示最近 30 个 Host 日历日，可切换 7 天并手动刷新，以 KPI、活跃度、每日 Token、模型和 Token 桶视图展示，完整数据保留在表格中。请求序号使页面在刷新、范围切换、错误和过期响应期间保留最后一次已提交结果。界面不声明余额、套餐、额度、费用、凭据或模型价格。

## Alternatives considered

**保留运行期进程计数器** — 未采用，因为重启、归档会话、seed 历史、失败请求和同一步替换都会使结果缺失或错误。

**按 Workspace 聚合** — 未采用，因为 Workspace 归属不是会话统计不变量，有效本机会话可以没有 Workspace。

**估算费用或展示账户余额** — 未采用，因为提供方 usage 不能证明计费价格、订阅状态、可用余额或额度；添加这些标签会把未知账户事实变成产品声明。

**增加一级分析路由或图表依赖** — 未采用，因为这是紧凑的设置项，所需图表可以由现有 Token 和无障碍表格完成。新增导航面和依赖只会增加所有权，不会增加可证实信息。

## Consequences

仪表盘可以跨重启工作，并用一套明确口径描述全部本机会话。Host 时区决定日历边界并返回浏览器。响应保证每个 Session 的切面一致，但不保证整个存储的原子性；扫描期间新增的数据在下次刷新出现。未报告 usage 的提供方仍贡献消息活跃度，但不会产生 Token 估算。实现承担事件投影、有界冷读取、缓存失效和无障碍替代的复杂度，以避免依赖瞬时累加器或不透明图表组件。
