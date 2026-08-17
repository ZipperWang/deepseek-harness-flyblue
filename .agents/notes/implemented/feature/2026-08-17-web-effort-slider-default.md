# Agent Note: Web ships the Claude-style reasoning slider by default

Status: implemented

English | [中文](2026-08-17-web-effort-slider-default.zh.md)

## Problem

The shipped composer model seat is the compact native trigger from `@deepseek-ai/dsh-client-ui-model-selection`. Flyblue users want the [DSH Claude Style Reasoning Slider](https://github.com/MEMZ-JZY/DSH-Claude-Style-Reasoning-Slider) on every Web session without running `dsh plugin add` per profile.

## Decision

`@deepseek-ai/dsh-web-app` depends on the embedded checkout at [`third-party/dsh-client-ui-effort-slider`](../../../../third-party/dsh-client-ui-effort-slider) (`file:`, pin `7bfa52083ed36ccd012fe34710f345dde19e42db`) and inserts an enabled `effort-slider` host row next to `ui-model-selection`. The package is an out-of-tree DSH bundle: host `index.js` serves `/effort-slider-assets/`, and `dsh.client` discovers the prebuilt `./client` half.

The slider injects `conversation.input.model` with `priority: -1`, so it shadows the native composer trigger. Native `ui-model-selection` stays mounted for `/model` and `ctx.modelDirectories`. Liang Calibrator and Big Fat Fish stay off until the user turns them on. A profile or home patch can set `effort-slider` `disabled: true` to restore the native trigger.

The plugin is not rewritten as a `@deepseek-ai/dsh-client-*` workspace package: it is already a `dsh.bundle` + `dsh.client` artifact, and a JS-only workspace package would fail the source-plane resolution gate.

## Alternatives considered

**Leave it to `dsh plugin --profile web add`.** Rejected: existing web profiles would stay on the native trigger, and a distribution default has to live in the shipped web-app layer.

**Add a third `PROFILE_TEMPLATES.web` bundle.** Rejected: already-initialized web profiles keep `[dsh-base, dsh-web-app]` and would not pick up the extra layer. Folding the row into `dsh-web-app` reaches every web profile that still uses the shipped template.

**Replace `ui-model-selection` entirely.** Rejected: the slider consumes `ctx.modelDirectories` and does not register `/model`.

**Vendor the source under `packages/client`.** Rejected: official client-package conventions require TypeScript, `tsdown`, invariants, and 100% coverage. The upstream package is a prebuilt ModuleLoader artifact.

## Consequences

A new or existing web profile that still loads `dsh-web-app` shows the slider on the composer model seat, and **Settings → General** gains the Big Fat Fish thumb switch. CLI, headless, and ACP assemblies do not mount the row. Disabling `effort-slider` restores the native chip without removing `/model`.

## Testing

`verify-cordis-config` requires the package in `packages/bundle/web-app/package.json`; knip ignores it there because the row names it only in `cordis.patch.yml`. `third-party/` joins `vendor/` as a translation-pairing discovery exclusion: a pinned dependency tree, not evolving translation source. The assembled Web goldens that render the composer model chip or **Settings → General** were refreshed to the slider's trigger and the Big Fat Fish row. The declared-reasoning scenario pins the reasoning-declaration contract to the native `ui-model-selection` menu through its overlay, so it keeps asserting the exact adapter-advertised level list instead of driving the slider's surface.

## Related

- [Session model selection in the Web composer](2026-07-24-web-session-model-selector.md)
- [Default model follows the picker](2026-08-07-default-model-follows-the-picker.md)
