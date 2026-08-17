/**
 * Pure types of the host-plane CodeGraph index manager. The generated Remote
 * client imports this vocabulary through `./client`.
 * @module @deepseek-ai/dsh-codegraph-index/types
 */

/** User-settings section owned by the index manager. */
export interface CodegraphSettings {
  /**
   * When true, a newly created session with a workspace cwd starts
   * `codegraph init` if that cwd is not already indexed.
   */
  readonly autoInit: boolean
}

/** Point-in-time index state for one session workspace. */
export interface CodegraphIndexStatus {
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
