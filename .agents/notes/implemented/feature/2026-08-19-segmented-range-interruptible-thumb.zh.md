# Agent Note: 设置分段开关的可打断滑动指示器

Status: implemented

[English](2026-08-19-segmented-range-interruptible-thumb.md) | 中文

## Problem

用量统计的天数开关和任务看板的进行中/已归档开关，靠改选中按钮自己的背景表示当前项。颜色过渡中再点另一项时，填充会跳到新按钮，而不是从当前几何位置继续移动，因此控件无法表达全覆盖可打断的滑动。

## Decision

`@deepseek-ai/dsh-client-ui-primitives` 中的 `SegmentedRange` 把选中填充画成绝对定位滑块，完整盖住当前选项。`useLayoutEffect` 与可选的 `ResizeObserver` 从选中按钮的 `offsetLeft` / `offsetWidth` 写入 `--thumb-x` / `--thumb-w`。首次测量之后，`transform` 和 `width` 使用 `--ds-transition-duration` 与 `--ds-ease-in-out` 过渡。CSS transition 会从当前 computed 值改向，因此滑动中途再点会从该位置继续。滑块为 `aria-hidden` 且 `pointer-events: none`；选项仍是无 role 条带上的 `aria-pressed` 按钮，用量统计的 ARIA 快照不会多出 `group` 或 `tablist`。`prefers-reduced-motion: reduce` 去掉过渡。用量统计和任务看板使用该原子；SSH 的密码/密钥条仍用本地 `.range`。

用量看板仍默认 30 天，并按[本机用量历史笔记](2026-08-18-local-usage-history-dashboard.md)为范围请求编号。任务看板仍按[设置工作台笔记](2026-08-18-settings-workbench-sections.md)拆分进行中与已归档列表。

## Alternatives considered

- **继续用按钮自身的选中背景。** 静止外观不变，但不能滑动，颜色过渡中途再点也无法从当前几何继续。
- **`@keyframes` 或先拉满再收缩的两段 cover。** 关键帧在改向时会从第一帧重开。拉满两格的 cover 会改变运动中的外形，并需要自写中断控制器。
- **Web Animations API。** 它可以取消和反向，但共享缓动与时长 token 作为 CSS transition 已经可打断，WAAPI 只会在脚本里再实现一套时钟。
- **抽出 settings-section 工具包，或在同一次改动里迁移 SSH `.range`。** 测量与过渡属于已有两个消费者的 primitives 原子。SSH 在该页提出同样动效需求之前保持本地条带。

## Consequences

`ui-usage-stats` 依赖 `@deepseek-ai/dsh-client-ui-primitives`。按钮最小宽度仍由调用方 CSS 变量决定（默认 `76px`，任务看板 `88px`）。范围请求序号、任务看板的乐观变更和 Host remote 不变。jsdom 覆盖断言 `aria-pressed`、第二次点击时的 `onChange`，以及 `aria-hidden` 滑块；不断言像素几何。

## Testing

`packages/client/ui-primitives/tests/segmented-range.client.spec.tsx` 固定该原子。两个 section spec 保留点击、回滚和过期响应用例。`apps/web/tests/usage-stats.e2e.ts` 仍通过 `aria-pressed` 切换「最近 7 天」。
