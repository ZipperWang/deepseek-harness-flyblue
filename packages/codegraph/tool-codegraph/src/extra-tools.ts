/**
 * Optional CodeGraph tools behind `Config.extraTools`. Default compositions
 * list only `explore`; extras stay defined so a deployment can re-enable them.
 * @module @deepseek-ai/dsh-tool-codegraph/extra-tools
 */

import type { CodegraphExtraToolId } from './types.ts'

/** Closed set of extra short names `Config.extraTools` may list. */
export const EXTRA_TOOL_IDS = [
  'status',
  'node',
  'search',
  'callers',
  'callees',
  'impact',
  'files',
] as const satisfies readonly CodegraphExtraToolId[]

/** Parameter schema fragment shared by extras that take `projectPath`. */
const PROJECT_PATH = {
  projectPath: {
    type: 'string',
    description: 'Project root that has a `.codegraph/` index. Defaults to the session workspace.',
  },
} as const

/** One extra tool's model-facing name, description, and parameters. */
export interface ExtraToolDefinition {
  readonly id: CodegraphExtraToolId
  readonly name: string
  readonly description: string
  readonly parameters: Record<string, unknown>
}

/** Extra tools that `extraTools` may register, keyed by short id. */
export const EXTRA_TOOLS: Record<CodegraphExtraToolId, ExtraToolDefinition> = {
  status: {
    id: 'status',
    name: 'codegraph_status',
    description: 'Index health check (files / nodes / edges). Skip unless debugging.',
    parameters: { ...PROJECT_PATH },
  },
  node: {
    id: 'node',
    name: 'codegraph_node',
    description:
      'One symbol\'s source and caller/callee trail, or a file\'s current line-numbered source. '
      + 'Use codegraph_explore for several related symbols or a flow.',
    parameters: {
      symbol: { type: 'string', description: 'Symbol name. Omit when reading a file via `file`.' },
      file: { type: 'string', description: 'File path or basename to read instead of a symbol.' },
      ...PROJECT_PATH,
    },
  },
  search: {
    id: 'search',
    name: 'codegraph_search',
    description: 'Quick symbol search by name. Returns locations only. Prefer codegraph_explore for source.',
    parameters: {
      query: { type: 'string', required: true, description: 'Symbol name or partial name.' },
      kind: { type: 'string', description: 'Optional node kind filter.' },
      limit: { type: 'number', description: 'Maximum results (default 10).' },
      ...PROJECT_PATH,
    },
  },
  callers: {
    id: 'callers',
    name: 'codegraph_callers',
    description: 'List functions that call `symbol`. Prefer codegraph_explore for the full flow.',
    parameters: {
      symbol: { type: 'string', required: true, description: 'Callee symbol name.' },
      limit: { type: 'number', description: 'Maximum results.' },
      ...PROJECT_PATH,
    },
  },
  callees: {
    id: 'callees',
    name: 'codegraph_callees',
    description: 'List functions that `symbol` calls. Prefer codegraph_explore for the full flow.',
    parameters: {
      symbol: { type: 'string', required: true, description: 'Caller symbol name.' },
      limit: { type: 'number', description: 'Maximum results.' },
      ...PROJECT_PATH,
    },
  },
  impact: {
    id: 'impact',
    name: 'codegraph_impact',
    description: 'Blast radius of changing `symbol`. Prefer codegraph_explore, which already includes this.',
    parameters: {
      symbol: { type: 'string', required: true, description: 'Symbol whose dependents to list.' },
      depth: { type: 'number', description: 'Traversal depth (default 2).' },
      ...PROJECT_PATH,
    },
  },
  files: {
    id: 'files',
    name: 'codegraph_files',
    description: 'Indexed file tree with language and symbol counts.',
    parameters: {
      path: { type: 'string', description: 'Restrict to files under this directory.' },
      pattern: { type: 'string', description: 'Glob filter such as `*.ts`.' },
      format: { type: 'string', enum: ['tree', 'flat', 'grouped'], description: 'Listing format (default tree).' },
      maxDepth: { type: 'number', description: 'Maximum directory depth.' },
      ...PROJECT_PATH,
    },
  },
}

/**
 * Validate `extraTools`: known ids, no duplicates. Fails at load.
 * @param extraTools - configured short names.
 * @returns the same list, typed as extra ids.
 */
export function resolveExtraTools(extraTools: readonly string[]): CodegraphExtraToolId[] {
  const seen = new Set<string>()
  const resolved: CodegraphExtraToolId[] = []
  for (const id of extraTools) {
    if (!(EXTRA_TOOL_IDS as readonly string[]).includes(id)) {
      throw new Error(`tool-codegraph: unknown extraTools entry ${JSON.stringify(id)} (expected ${EXTRA_TOOL_IDS.join(', ')})`)
    }
    if (seen.has(id)) {
      throw new Error(`tool-codegraph: extraTools repeats ${JSON.stringify(id)}`)
    }
    seen.add(id)
    resolved.push(id as CodegraphExtraToolId)
  }
  return resolved
}
