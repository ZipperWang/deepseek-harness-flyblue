# CodeGraph 索引

[English](codegraph.md) | 中文

Web GUI 的 host 平面索引生命周期。`ctx.codegraphIndex` 读取 `session.header.cwd` 并启动 `codegraph init`；`/codegraph-init` 是 [`dsh-command-codegraph-init`](../../packages/codegraph/command-codegraph-init/README.md) 中的用户命令消费方。面向模型的工具仍在 [`dsh-tool-codegraph`](../../packages/codegraph/tool-codegraph/README.md)。设计记录：[Web host CodeGraph 索引管理器](../../.agents/notes/implemented/feature/2026-08-13-web-codegraph-index-manager.md)。

来源：[`packages/codegraph/codegraph-index/src/types.ts`](../../packages/codegraph/codegraph-index/src/types.ts)

## 状态

`status` 与 `init` 返回这份快照。`projectPath` 始终是会话 cwd；客户端不能另指定根目录。

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

## 设置

`codegraph` 设置命名空间是 `{ autoInit: boolean }`，默认 `false`。

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
