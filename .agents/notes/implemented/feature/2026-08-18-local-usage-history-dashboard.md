# Agent Note: Derive local usage history from session logs

Status: implemented

English | [中文](2026-08-18-local-usage-history-dashboard.zh.md)

## Problem

A running-process counter cannot answer how this device was used over time: it loses cold and archived sessions, double-counts early and final usage samples, and suggests account facts such as balance that the harness cannot establish. A Workspace-scoped view also omits valid local sessions without a Workspace assignment.

## Decision

`@deepseek-ai/dsh-usage-stats` derives history from the durable session vocabulary. It unions live `sessions.list()` identities with `sessionPersistence.listSnapshots()`, deduplicates by Session ID, prefers the live immutable event slice, and inspects only cold logs. The cache advances live projections by object identity and seq and invalidates cold projections by persistence revision. Cold inspection has a configurable concurrency bound. A storage error rejects the request instead of returning a partial total.

Accounting follows token-meter replacement semantics. A usage chunk remains after a failed request, while the final sample for the same turn and step replaces it. Chunk attribution follows the active request header and a final assistant message can replace the route. Total Token includes the four disjoint billing buckets; reasoning remains an output subset. Activity counts only direct-user and non-empty assistant messages.

The Web presentation stays under Settings → Usage statistics. It defaults to 30 Host calendar days, offers 7 days and manual refresh, and shows KPI, activity, daily Token, model, and bucket views with complete tables. Request sequencing preserves the last committed result across refreshes, range changes, errors, and stale responses. The surface presents no balance, plan, quota, cost, credential, or model-price claims.

## Alternatives considered

**Keep a live process counter** — rejected because restarts, archived sessions, seed history, failed requests, and same-step replacement all make it incomplete or incorrect.

**Aggregate by Workspace** — rejected because Workspace membership is not a session-accounting invariant and valid local sessions can have no Workspace.

**Estimate cost or expose account balance** — rejected because provider usage does not prove billing price, subscription state, available credit, or quota. Adding those labels would turn unknown account facts into product claims.

**Add a top-level analytics route or a chart dependency** — rejected because this is a compact settings concern and the required charts are small token-driven views with accessible tables. A new navigation surface and dependency would add ownership without improving the available facts.

## Consequences

The dashboard survives restarts and describes all local sessions with one explicit accounting vocabulary. Host timezone controls calendar boundaries and is returned to the browser. A response is consistent per Session but not atomic across the whole store; data appended during a scan appears on the next refresh. Providers that report no usage still contribute message activity but no Token estimate. The implementation pays for event projection, bounded cold reads, cache invalidation, and accessibility alternatives instead of relying on a transient accumulator or opaque chart component.
