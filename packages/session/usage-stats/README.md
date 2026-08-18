# @deepseek-ai/dsh-usage-stats

English | [中文](README.zh.md)

Host plugin deriving a browser-safe usage history from every local session log. `usageStats.stats({ days: 7 | 30 })` returns Host-calendar daily activity, five provider-reported Token buckets, distinct session and visible-message counts, the true current activity streak, and provider/model aggregates. The service reads no credentials, prices, plans, balances, quotas, or Workspace registry.

## Accounting

`totalTokens` is uncached input + output + cache read + cache write. `reasoningTokens` is an informational subset of output and is never added again. A usage chunk remains billable when a request fails; a later usage sample for the same turn and step replaces it. Chunks use the active request header route, while a final assistant message can replace the provider/model attribution. Visible messages are direct-user messages and assistant messages with non-empty content; plugin context, tool results, and empty usage carriers do not count.

The selected range includes today and uses the Host timezone returned in the response. Daily rows are dense. Session count includes each session with a visible message or valid usage in the range once. The current streak reads all available history and is zero when today has no visible message.

## Composition

```yaml
- id: usage-stats
  name: '@deepseek-ai/dsh-usage-stats'
  config:
    inspectConcurrency: 4
```

`inspectConcurrency` bounds cold persistence reads from 1 through 32 and defaults to 4. The plugin injects `sessions` and `sessionPersistence`. It unions live sessions with persistence snapshots by Session ID, prefers the immutable live event slice, and inspects cold logs. Live cache entries advance by Session object and seq; cold entries invalidate by persistence revision. Entries absent from both sources are removed. Any listing or inspection error rejects the complete request, so clients can keep the prior result and retry.

## Model Experience

None, as the plugin derives a client read model from already-logged events and adds no prompt, message, tool, or session event.

#### KV Cache effect

None; it never assembles or sends a model request.

## Known Limitations and Deferred Work

- Statistics are provider-reported accounting, not estimated cost. A model that reports no usage can still contribute visible-message activity.
- One response is a consistent slice per session, not an atomic snapshot across all sessions. Events created during a scan appear on the next refresh.
- Calendar boundaries follow the Host process timezone. Changing that timezone changes subsequent day attribution.
