# Agent Note: Interruptible sliding thumb for settings segmented ranges

Status: implemented

English | [中文](2026-08-19-segmented-range-interruptible-thumb.zh.md)

## Problem

The usage-statistics day switch and the task-board active/archived switch painted the selected option by restyling that button. A second click during the color fade jumped to the new fill instead of moving from the current geometry, so the control could not express a fully interruptible slide.

## Decision

`SegmentedRange` in `@deepseek-ai/dsh-client-ui-primitives` draws the selected fill as an absolutely positioned thumb that covers the current option. `useLayoutEffect` plus an optional `ResizeObserver` write `--thumb-x` / `--thumb-w` from the selected button's `offsetLeft` / `offsetWidth`. After the first measure, `transform` and `width` transition with `--ds-transition-duration` and `--ds-ease-in-out`. CSS transitions retarget from the current computed values, so a click mid-slide continues from that position. The thumb is `aria-hidden` and `pointer-events: none`; the options stay `aria-pressed` buttons on an unlabeled strip so the usage-stats ARIA snapshot does not grow a `group` or `tablist`. `prefers-reduced-motion: reduce` drops the transition. Usage statistics and the task board consume this atom; the SSH password/key strip stays a local `.range`.

The usage dashboard still defaults to 30 days and sequences range requests as in [the local usage-history note](2026-08-18-local-usage-history-dashboard.md). The task board still splits active and archived lists as in [the settings workbench note](2026-08-18-settings-workbench-sections.md).

## Alternatives considered

- **Keep per-button selected backgrounds.** That preserves the resting look but cannot slide, and a mid-fade click cannot continue from the current geometry.
- **`@keyframes` or a two-phase expand-then-contract cover.** Keyframes restart from their first frame when retargeted. A cover that spans both options changes the mid-motion silhouette and needs a custom interrupt controller.
- **Web Animations API.** It can cancel and reverse, but the shared ease and duration tokens already interrupt when applied as CSS transitions, and WAAPI would duplicate that clock in script.
- **A settings-section kit, or migrating the SSH `.range` in the same change.** The measurement and transition belong on a primitives atom with two current consumers. SSH keeps its local strip until that page asks for the same motion.

## Consequences

`ui-usage-stats` depends on `@deepseek-ai/dsh-client-ui-primitives`. Button min-width stays a caller CSS variable (`76px` default, `88px` on the task board). Range request sequencing, optimistic task-board mutations, and Host remotes are unchanged. jsdom coverage asserts `aria-pressed`, `onChange` during a second click, and an `aria-hidden` thumb; it does not assert pixel geometry.

## Testing

`packages/client/ui-primitives/tests/segmented-range.client.spec.tsx` pins the atom. The two section specs keep their click, rollback, and stale-response cases. `apps/web/tests/usage-stats.e2e.ts` still toggles `最近 7 天` through `aria-pressed`.
