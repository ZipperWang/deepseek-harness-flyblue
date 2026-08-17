/**
 * Shared types for the CodeGraph tool consumer. Runtime values live in the
 * modules that construct them.
 * @module @deepseek-ai/dsh-tool-codegraph/types
 */

/** Isolation mode for talking to the bundled CodeGraph engine. */
export type CodegraphIsolation = 'auto' | 'in-process' | 'subprocess'

/** Short names that `extraTools` may enable in addition to `explore`. */
export type CodegraphExtraToolId =
  | 'status'
  | 'node'
  | 'search'
  | 'callers'
  | 'callees'
  | 'impact'
  | 'files'

/** Canonical JSON value returned by every CodeGraph tool. */
export interface CodegraphToolValue {
  /** Model-facing body (explore markdown, status text, or guidance). */
  text: string
  /** Absolute project root the call resolved against. */
  projectPath: string
  /** False when the engine is missing or the project has no `.codegraph/` index. */
  indexed: boolean
}

/** Result of one engine invocation, before workspace wrapping. */
export interface CodegraphEngineResult {
  text: string
  isError: boolean
  indexed: boolean
}

/** Process-isolated CLI runner used by the subprocess driver. */
export interface CodegraphProcessRunner {
  /**
   * Run the vendored CodeGraph CLI with `argv` after the script path.
   * @param argv - CLI arguments (for example `['explore', '--path', root, query]`).
   * @param options - abort signal for the child process.
   * @returns collected stdio and the process exit code.
   */
  run(
    argv: string[],
    options: { signal: AbortSignal },
  ): Promise<{ stdout: string; stderr: string; code: number }>
}

/** One opened in-process graph used by the in-process driver. */
export interface OpenedCodegraph {
  /**
   * Dispatch one MCP-named tool against this graph.
   * @param toolName - full name such as `codegraph_explore`.
   * @param args - already-validated tool arguments, including `projectPath`.
   */
  execute(toolName: string, args: Record<string, unknown>): Promise<CodegraphEngineResult>
  /** Release the underlying SQLite handle. */
  close(): void
}

/** Lazy bindings to the bundled `@colbymchenry/codegraph` package. */
export interface CodegraphBindings {
  /**
   * Whether `root` (or a walk from it) has a `.codegraph/` index.
   * @param root - absolute project path.
   */
  isInitialized(root: string): boolean
  /**
   * Open a read-only graph at `root`.
   * @param root - absolute project path that already has an index.
   */
  open(root: string): Promise<OpenedCodegraph>
}

/** Disposable engine used by registered tools. */
export interface CodegraphDriver {
  /**
   * Run one CodeGraph tool.
   * @param toolName - full name such as `codegraph_explore`.
   * @param args - arguments including the resolved `projectPath`.
   * @param signal - call abort signal.
   */
  execute(
    toolName: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<CodegraphEngineResult>
  /** Close cached graphs and drop process handles. */
  dispose(): void
}
