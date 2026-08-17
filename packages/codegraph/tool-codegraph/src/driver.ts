/**
 * Isolation choice and the two CodeGraph drivers: in-process ToolHandler, or
 * the vendored CLI in a child process.
 * @module @deepseek-ai/dsh-tool-codegraph/driver
 */

import type {
  CodegraphBindings,
  CodegraphDriver,
  CodegraphEngineResult,
  CodegraphIsolation,
  CodegraphProcessRunner,
  OpenedCodegraph,
} from './types.ts'

/** Node major at which in-process WASM grammar compilation is unsafe. */
export const UNSAFE_NODE_MAJOR = 25

/** Guidance when the bundled engine cannot be loaded. */
export const ENGINE_UNAVAILABLE_TEXT =
  'CodeGraph is bundled with this harness but the engine failed to load. '
  + 'Continue with read/grep/glob for this project. Do not try to install or initialize CodeGraph yourself.'

/**
 * Guidance when the resolved project has no `.codegraph/` index.
 * @param projectPath - absolute project root that was queried.
 * @returns the success-shaped not-indexed banner.
 */
export function notIndexedText(projectPath: string): string {
  return `CodeGraph isn't available here — no .codegraph/ index exists in ${projectPath}. `
    + 'Continue with your usual tools; indexing is the user\'s decision, do not run it yourself. '
    + '(The project owner can enable CodeGraph with `codegraph init`.)'
}

/**
 * Resolve `auto` to in-process below Node 25 and subprocess at or above it.
 * @param isolation - configured isolation.
 * @param nodeMajor - `process.versions.node` major.
 * @returns the concrete isolation used for this process.
 */
export function resolveIsolation(
  isolation: CodegraphIsolation,
  nodeMajor: number,
): 'in-process' | 'subprocess' {
  if (isolation === 'auto') return nodeMajor >= UNSAFE_NODE_MAJOR ? 'subprocess' : 'in-process'
  return isolation
}

/**
 * Current Node.js major version.
 * @param version - a `process.versions.node` string; defaults to the running process.
 * @returns the major component, or 0 when it is missing.
 */
export function nodeMajor(version: string = process.versions.node): number {
  return Number.parseInt(version.split('.')[0] || '0', 10)
}

/**
 * Build CLI argv (after the script path) for one MCP-named tool.
 * @param toolName - full tool name.
 * @param args - arguments including resolved `projectPath`.
 * @returns argv after the CLI script path.
 */
export function buildCliArgv(toolName: string, args: Record<string, unknown>): string[] {
  const projectPath = String(args.projectPath)
  switch (toolName) {
    case 'codegraph_explore':
      return [
        'explore',
        '--path',
        projectPath,
        ...typeof args.maxFiles === 'number' ? ['--max-files', String(args.maxFiles)] : [],
        String(args.query),
      ]
    case 'codegraph_status':
      return ['status', projectPath]
    case 'codegraph_search':
      return [
        'query',
        String(args.query),
        '--path',
        projectPath,
        ...typeof args.limit === 'number' ? ['--limit', String(args.limit)] : [],
        ...typeof args.kind === 'string' ? ['--kind', args.kind] : [],
      ]
    case 'codegraph_node':
      return [
        'node',
        ...typeof args.symbol === 'string' ? [args.symbol] : [],
        '--path',
        projectPath,
        ...typeof args.file === 'string' ? ['--file', args.file] : [],
        ...typeof args.offset === 'number' ? ['--offset', String(args.offset)] : [],
        ...typeof args.limit === 'number' ? ['--limit', String(args.limit)] : [],
      ]
    case 'codegraph_callers':
      return [
        'callers',
        String(args.symbol),
        '--path',
        projectPath,
        ...typeof args.limit === 'number' ? ['--limit', String(args.limit)] : [],
      ]
    case 'codegraph_callees':
      return [
        'callees',
        String(args.symbol),
        '--path',
        projectPath,
        ...typeof args.limit === 'number' ? ['--limit', String(args.limit)] : [],
      ]
    case 'codegraph_impact':
      return [
        'impact',
        String(args.symbol),
        '--path',
        projectPath,
        ...typeof args.depth === 'number' ? ['--depth', String(args.depth)] : [],
      ]
    case 'codegraph_files':
      return [
        'files',
        '--path',
        projectPath,
        ...typeof args.path === 'string' ? ['--filter', args.path] : [],
        ...typeof args.pattern === 'string' ? ['--pattern', args.pattern] : [],
        ...typeof args.format === 'string' ? ['--format', args.format] : [],
        ...typeof args.maxDepth === 'number' ? ['--max-depth', String(args.maxDepth)] : [],
      ]
    /* v8 ignore next -- closed tool set; unknown names never register. */
    default:
      return [toolName, '--path', projectPath]
  }
}

/**
 * Classify CLI output as a missing index versus a served result.
 * @param text - combined stdout/stderr.
 * @returns true when the text is a missing-index banner.
 */
export function looksUnindexed(text: string): boolean {
  return /no \.codegraph\/|not initialized|isn't available here/i.test(text)
}

/**
 * In-process driver: one read-only `CodeGraph` per project, dispatched through
 * the bundled `ToolHandler`.
 * @param loadBindings - lazy loader so apply() does not import the engine.
 * @returns a disposable in-process driver.
 */
export function createInProcessDriver(loadBindings: () => CodegraphBindings): CodegraphDriver {
  let bindings: CodegraphBindings | undefined
  const graphs = new Map<string, OpenedCodegraph>()
  return {
    async execute(toolName, args) {
      const projectPath = String(args.projectPath)
      try {
        bindings ??= loadBindings()
      } catch {
        return { text: ENGINE_UNAVAILABLE_TEXT, isError: false, indexed: false }
      }
      if (!bindings.isInitialized(projectPath)) {
        return { text: notIndexedText(projectPath), isError: false, indexed: false }
      }
      let graph = graphs.get(projectPath)
      if (graph === undefined) {
        graph = await bindings.open(projectPath)
        graphs.set(projectPath, graph)
      }
      return graph.execute(toolName, args)
    },
    dispose() {
      for (const graph of graphs.values()) graph.close()
      graphs.clear()
    },
  }
}

/**
 * Subprocess driver: one vendored CLI invocation per call.
 * @param runner - process runner (real spawn or a test double).
 * @returns a disposable subprocess driver.
 */
export function createSubprocessDriver(runner: CodegraphProcessRunner): CodegraphDriver {
  return {
    async execute(toolName, args, signal) {
      const projectPath = String(args.projectPath)
      let result: { stdout: string; stderr: string; code: number }
      try {
        result = await runner.run(buildCliArgv(toolName, args), { signal })
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw error
        return { text: ENGINE_UNAVAILABLE_TEXT, isError: false, indexed: false }
      }
      const text = [result.stdout, result.stderr].filter(part => part.length > 0).join('\n').trim()
      if (result.code !== 0 && looksUnindexed(text)) {
        return { text, isError: false, indexed: false }
      }
      return {
        text: text.length > 0 ? text : notIndexedText(projectPath),
        isError: false,
        indexed: result.code === 0,
      }
    },
    dispose() {},
  }
}

/**
 * Map a ToolHandler / CLI payload into the engine result.
 * @param text - body text.
 * @param isError - whether the engine marked the call as a hard failure.
 * @returns the engine result, with `indexed` derived from the body.
 */
export function engineResult(text: string, isError: boolean): CodegraphEngineResult {
  return { text, isError, indexed: !isError && !looksUnindexed(text) }
}
