/**
 * Pure UI presentation for CodeGraph tool calls.
 * @module @deepseek-ai/dsh-tool-codegraph/present
 */

import type { GenericCallView } from '@deepseek-ai/dsh-tools'

/** Arguments that may carry a display title and an optional project path. */
export interface CodegraphPresentArgs {
  readonly query?: string
  readonly symbol?: string
  readonly file?: string
  readonly path?: string
  readonly pattern?: string
  readonly projectPath?: string
}

/**
 * Pending card for a CodeGraph call: a search-kind generic card titled by the
 * most specific argument, with an optional location for the project root.
 * @param args - model arguments (may be partial on replay).
 * @param fallbackTitle - title when no query/symbol/path is present.
 * @returns a generic search card.
 */
export function presentCodegraphCall(args: CodegraphPresentArgs, fallbackTitle: string): GenericCallView {
  const title = firstText(args.query, args.symbol, args.file, args.path, args.pattern) ?? fallbackTitle
  const projectPath = typeof args.projectPath === 'string' && args.projectPath.length > 0
    ? args.projectPath
    : undefined
  return {
    card: 'generic',
    title,
    kind: 'search',
    rawInput: title,
    ...projectPath === undefined ? {} : { locations: [{ path: projectPath }] },
  }
}

/**
 * First non-empty string among the candidates.
 * @param values - title candidates in preference order.
 */
function firstText(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return undefined
}
