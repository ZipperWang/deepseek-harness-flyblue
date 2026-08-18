/** Chinese usage-dashboard dictionary. */
export const zh = {
  nav: '用量统计', title: '用量统计', intro: '基于此设备上的全部会话日志统计，不包含费用、余额或套餐信息。',
  loading: '正在加载用量统计', refresh: '刷新', refreshing: '刷新中…', updating: '正在更新，当前仍显示上次结果。', retry: '重试', error: '无法更新统计', 'error.empty': '暂时无法显示统计。',
  'range.label': '统计范围', 'range.7': '最近 7 天', 'range.30': '最近 30 天', days: '天', messages: '条消息', none: '暂无', noUsage: '未报告 Token',
  'kpi.tokens': 'Token 总量', 'kpi.sessions': '会话数', 'kpi.messages': '消息数', 'kpi.activeDays': '活跃天数', 'kpi.streak': '当前连续活跃', 'kpi.model': '最常用模型',
  'activity.title': '消息活跃度', 'activity.help': '每格代表一个 Host 日历日，颜色越深表示可见消息越多。', 'activity.empty': '所选范围内没有可见消息。',
  'trend.title': '每日 Token 趋势', 'trend.empty': '所选范围内没有 Token 数据。', 'trend.noUsage': '有消息活动，但模型提供方没有报告 Token 用量。', 'chart.summary': '所选范围共有 {tokens} Token 和 {messages} 条可见消息。',
  'models.title': '模型用量', 'models.empty': '没有可归属的模型用量。', 'models.summary': '按 Token 展示 {count} 个模型。', other: '其他',
  'breakdown.title': 'Token 构成', 'bucket.input': '未缓存输入', 'bucket.output': '输出', 'bucket.cacheRead': '缓存读取', 'bucket.cacheWrite': '缓存写入', reasoning: '其中推理 Token 为 {value}，已包含在输出中，不重复计入总量。',
  details: '查看完整明细', 'models.table': '完整模型用量', 'daily.table': '每日统计', provider: '提供方', model: '模型', tokens: 'Token', sessions: '会话', date: '日期', updated: '生成于',
} as const

/** English usage-dashboard dictionary. */
export const en: Record<keyof typeof zh, string> = {
  nav: 'Usage statistics', title: 'Usage statistics', intro: 'Derived from every local session log on this device. Costs, balances, and plans are not included.',
  loading: 'Loading usage statistics', refresh: 'Refresh', refreshing: 'Refreshing…', updating: 'Updating; the previous result remains visible.', retry: 'Retry', error: 'Could not update statistics', 'error.empty': 'Statistics are temporarily unavailable.',
  'range.label': 'Statistics range', 'range.7': 'Last 7 days', 'range.30': 'Last 30 days', days: 'days', messages: 'messages', none: 'None', noUsage: 'No Token usage',
  'kpi.tokens': 'Total Tokens', 'kpi.sessions': 'Sessions', 'kpi.messages': 'Messages', 'kpi.activeDays': 'Active days', 'kpi.streak': 'Current streak', 'kpi.model': 'Top model',
  'activity.title': 'Message activity', 'activity.help': 'Each cell is one Host calendar day; darker cells have more visible messages.', 'activity.empty': 'No visible messages in this range.',
  'trend.title': 'Daily Token trend', 'trend.empty': 'No Token usage in this range.', 'trend.noUsage': 'Messages are active, but the model provider reported no Token usage.', 'chart.summary': 'The range contains {tokens} Tokens and {messages} visible messages.',
  'models.title': 'Model usage', 'models.empty': 'No model-attributed usage is available.', 'models.summary': '{count} models shown by Token usage.', other: 'Other',
  'breakdown.title': 'Token breakdown', 'bucket.input': 'Uncached input', 'bucket.output': 'Output', 'bucket.cacheRead': 'Cache read', 'bucket.cacheWrite': 'Cache write', reasoning: '{value} reasoning Tokens are included in output and are not added to the total again.',
  details: 'View complete details', 'models.table': 'Complete model usage', 'daily.table': 'Daily statistics', provider: 'Provider', model: 'Model', tokens: 'Tokens', sessions: 'Sessions', date: 'Date', updated: 'Generated',
}
