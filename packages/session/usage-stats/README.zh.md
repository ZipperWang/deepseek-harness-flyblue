# @deepseek-ai/dsh-usage-stats

[English](README.md) | 中文

Host 插件，从全部本机会话日志派生可安全发送给浏览器的用量历史。`usageStats.stats({ days: 7 | 30 })` 返回按 Host 日历日统计的活跃数据、五类提供方 Token、不同会话与可见消息数量、真实当前连续活跃天数，以及按提供方/模型聚合的数据。服务不读取凭据、价格、套餐、余额、额度或 Workspace 注册表。

## 统计口径

`totalTokens` 等于未缓存输入、输出、缓存读取和缓存写入之和。`reasoningTokens` 是输出的明细子集，不会再次加入总量。请求失败时，usage chunk 仍计入统计；同一 turn/step 的后续 usage 会替换早期样本。chunk 归属于当时生效的 request header 路由，最终助手消息可以更新提供方/模型归属。可见消息仅包括直接用户消息和内容非空的助手消息；插件上下文、工具结果以及仅承载 usage 的空消息不计数。

所选范围包含今天，并使用响应中返回的 Host 时区。每日序列为稠密序列。会话在范围内只要有可见消息或有效 usage 就计数一次。当前连续活跃天数读取全部可用历史；今天没有可见消息时为 0。

## 组合方式

```yaml
- id: usage-stats
  name: '@deepseek-ai/dsh-usage-stats'
  config:
    inspectConcurrency: 4
```

`inspectConcurrency` 限制冷会话持久化读取并发数，范围为 1–32，默认值为 4。插件注入 `sessions` 与 `sessionPersistence`，按 Session ID 合并实时会话和持久化快照，优先读取实时会话的不可变事件切面，冷会话通过 inspect 读取。实时缓存按 Session 对象和 seq 增量推进，冷缓存按持久化 revision 失效；两个来源中都已不存在的条目会被清理。任意列表或 inspect 错误都会使整次请求失败，客户端可以保留旧结果并重试。

## 模型体验

无，因为插件只从已有日志派生客户端读模型，不增加提示词、消息、工具或会话事件。

#### KV Cache 影响

无；插件不会组装或发送模型请求。

## 已知限制与后续工作

- 统计来自提供方报告，不是费用估算。模型未报告 usage 时，仍可以贡献可见消息活跃数据。
- 响应保证每个 Session 的切面一致，但不保证全部 Session 的原子瞬时快照；扫描期间新增的数据会在下次刷新出现。
- 日历边界采用 Host 进程时区；时区变化会改变后续的日期归属。
