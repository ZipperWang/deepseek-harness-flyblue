# Agent Note: CodeGraph explore query contract

Status: implemented

English | [中文](2026-08-17-codegraph-explore-query-contract.zh.md)

## Problem

`@colbymchenry/codegraph@1.5.0` explore token-matches the query. Open prose, a lone file path, and an existence check fail open: "how does indexing work" lands on unrelated `index` symbols; `driver.ts` hits every `drive`; a fake name still returns `exists` / `Symbol`. Teaching those forms as the default query wastes a turn and the engine's large source dump.

## Decision

The model-facing query contract lives in `packages/codegraph/tool-codegraph/src/prompt.ts`: `CODEGRAPH_PROMPT_TEXT`, `EXPLORE_TOOL_DESCRIPTION`, and `EXPLORE_QUERY_DESCRIPTION`. Queries are unique identifier names. A "how X reaches Y" form must name both ends. Open prose, a lone path, and existence checks are forbidden. A clean source dump is Read-equivalent. Token-soup hits and a missing `.codegraph/` fall back to `read` / `grep` / `glob`. Shipped presets still list only `codegraph_explore`.

The [native tools note](2026-08-12-flyblue-codegraph-tools.md) still owns shipping the engine and forbidding agent-run `codegraph init`.

## Alternatives considered

**Enable `extraTools` (`search` / `node` / `callers`) by default.** Rejected: each extra schema is a standing per-request cost, and explore already returns callers, callees, and blast radius when the query names the symbols.

**Change the bundled engine's retrieval.** Rejected: the pin is `1.5.0`; a retrieval rewrite is a separate upgrade, not a distribution copy fix.

**Keep teaching natural-language and path queries.** Rejected: those forms are the measured failure mode.

## Consequences

Standard / PTC / Create sessions pay a slightly shorter fixed prefix and get an explicit do-not list. A model that still asks in open prose can waste a turn; the prompt now names that failure. Extras remain available as a load-time opt-in.

## Testing

`packages/codegraph/tool-codegraph/tests/tool-codegraph.spec.ts` pins the assembled `tool:codegraph` section and the explore schema strings to the exported constants. The package README verbatim fence quotes the prompt. `docs/tool-catalog.md` is regenerated from the same description.

## Related

- [Native CodeGraph tools](2026-08-12-flyblue-codegraph-tools.md)
