# @deepseek-ai/dsh-client-ui-usage-stats

English | [中文](README.zh.md)

Web settings dashboard for `@deepseek-ai/dsh-usage-stats`. It registers the existing `settings.section` id `usage-stats`; no top-level navigation is added.

The initial view requests 30 days and can switch to 7 days or refresh manually. Six KPI cards, a visible-message heatmap, stacked daily Token bars, model donut and ranking, and the disjoint Token-bucket breakdown fit the settings content column. The model chart keeps four models plus Other, while expandable tables retain every model and day. Reasoning is shown beneath output and is not presented as an additional total bucket.

The dashboard uses CSS Modules and existing theme, shadow, and motion tokens. Compact `Intl.NumberFormat` values carry exact accessible names; dates use `Intl.DateTimeFormat`. Daily chart entries are keyboard reachable, charts include summaries, and tables provide a non-visual alternative. Initial loading keeps the layout stable. Refresh and range changes retain the previous result with a busy message; request sequencing ignores stale responses. A failed update retains the committed range and data and exposes Retry. Empty activity and missing provider usage have separate explanations.

## Model Experience

None, as this browser plugin renders Host-derived data and adds no model-visible content.

#### KV Cache effect

None; it never participates in provider requests.

## Known Limitations and Deferred Work

- The dashboard refreshes on mount, range change, or explicit user action; it does not poll.
- Visual charts intentionally use five existing semantic series colors. Labels, fixed ordering, accessible summaries, and complete tables carry the same distinctions without color.
- Costs, balance, plan, quota, and model pricing are intentionally absent because the Host service does not establish those facts.
