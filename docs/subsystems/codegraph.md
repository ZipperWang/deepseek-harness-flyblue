# CodeGraph index

English | [中文](codegraph.zh.md)

Host-plane index lifecycle for the Web GUI. `ctx.codegraphIndex` reads `session.header.cwd` and starts `codegraph init`; `/codegraph-init` is the human command consumer in [`dsh-command-codegraph-init`](../../packages/codegraph/command-codegraph-init/README.md). The model-facing tools stay in [`dsh-tool-codegraph`](../../packages/codegraph/tool-codegraph/README.md). Design record: [Web host CodeGraph index manager](../../.agents/notes/implemented/feature/2026-08-13-web-codegraph-index-manager.md).

Source: [`packages/codegraph/codegraph-index/src/types.ts`](../../packages/codegraph/codegraph-index/src/types.ts)

## Status

`status` and `init` return this snapshot. `projectPath` is always the session cwd; the client cannot name another root.

```ts type-equiv
/** Point-in-time index state for one session workspace. */
interface CodegraphIndexStatus {
  /**
   * Absolute workspace cwd the session header names, or `null` when the
   * session has no workspace.
   */
  readonly projectPath: string | null
  /** Whether `.codegraph/` is present for `projectPath`. */
  readonly indexed: boolean
  /** Whether an init process for this cwd is running in this host. */
  readonly indexing: boolean
  /** Last failed probe or init for this cwd, absent when none is current. */
  readonly error?: string
}
```

## Settings

The `codegraph` settings namespace is `{ autoInit: boolean }`, default `false`.

```ts type-equiv
/** User-settings section owned by the index manager. */
interface CodegraphSettings {
  /**
   * When true, a newly created session with a workspace cwd starts
   * `codegraph init` if that cwd is not already indexed.
   */
  readonly autoInit: boolean
}
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxcodegraphindex--codegraphindexservice"></a>

### `ctx.codegraphIndex` — `CodegraphIndexService`

Host service (`ctx.codegraphIndex`) for user-triggered workspace indexing.

```ts cordis-catalog
/**
 * Read the current workspace index state for one live session.
 * The path is always `session.header.cwd`; the client cannot name another root.
 * @param sessionId - live session identity.
 * @returns the point-in-time status.
 */
@Remote('status') status(sessionId: SessionId): CodegraphIndexStatus

/**
 * Start `codegraph init` for the session cwd and return immediately.
 * A second call for the same resolved cwd joins the in-flight job.
 * @param sessionId - live session identity.
 * @returns the status after the start attempt (often `indexing: true`).
 */
@Remote('init') init(sessionId: SessionId): CodegraphIndexStatus
```

Types: [SessionId](core.md)

Source: [`packages/codegraph/codegraph-index/src/index.ts:80`](../../packages/codegraph/codegraph-index/src/index.ts)
<!-- END GENERATED cordis-surface -->
