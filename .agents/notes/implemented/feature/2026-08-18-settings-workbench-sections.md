# Agent Note: Settings workbench sections — tokenized presentation and existing remotes

Status: implemented

English | [中文](2026-08-18-settings-workbench-sections.zh.md)

## Problem

The settings modal's Git graph, task board, SSH operations, and workspace inspector sections rendered unstyled HTML lists and forms. They ignored the `--dsw-*` token system, had no loading or empty states, and left Host remotes unused even when the section intro named those operations (branch actions, host configuration, task mutations).

## Decision

Each section stays a `settings.section` registrant in its existing package. Presentation uses a CSS Module plus `--dsw-alias-*` / `--dsw-shadow-*` / `--ds-*` tokens, `Button`/`Input`/`Pill`/`TerminalBlock` primitives, and the existing icon set. Motion uses `--ds-ease-in-out` with `prefers-reduced-motion` guards. Inject faces expose the Host remotes the Host already publishes; no Host package changes.

Git graph (`ui-git-graph`) classifies porcelain pairs through `statusMeta`, assigns commit lanes through `assignLanes`, and stages, unstages, discards (two-step), switches, and creates branches. Task board (`ui-task-board`) splits active and archived tabs, applies archive/create/rename/delete optimistically, then reloads the ledger so the Host list stays authoritative. SSH (`ui-ssh`) adds and edits hosts through `put`, removes them through `remove`, and appends one `TerminalBlock` per `exec`; a dropped dispatch keeps partial output and a result-unknown warning. Workspace inspector (`ui-workspace-inspector`) stays read-only: breadcrumb `tree(path)`, debounced `search`, and a preview pane with size, version token, and truncation.

Every Remote batch carries a request sequence so a stale response cannot overwrite a newer one. Nav labels and `order` values stay `41–44`.

## Alternatives considered

- **Visual refresh only, same inject faces.** The section intros already name branch actions, host configuration, and task scheduling; leaving those remotes unused would keep the "lack of detail" the request named.
- **File create/rename/save/delete in the inspector.** The Host remotes exist, but the settings modal is not an editor; confirmation and stale-write flows belong outside this read-only inspection page.
- **New theme motion tokens.** `--ds-ease-in-out` and `--ds-transition-duration*` already encode the non-linear curve; a theme change would widen the blast radius for no extra contract.
- **A shared settings-section kit package.** Four sections share tokens and primitives, not a third abstraction; extracting a kit now would invent an owner without a second consumer family.

## Consequences

The four packages now depend on `@deepseek-ai/dsh-client-ui-primitives` (a platform module) and carry apply / section / styles tests under the per-file coverage gate. Destructive Git discard, archived-task delete, and SSH host delete stay two-step. The inspector remains a projection of the first registered workspace. Settings-chrome snapshots stay on the General section and do not pin these four pages.
