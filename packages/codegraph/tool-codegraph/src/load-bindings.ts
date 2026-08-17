/**
 * Load the bundled `@colbymchenry/codegraph` CJS package. Isolated so unit
 * tests can inject a fake driver without importing the engine.
 * @module @deepseek-ai/dsh-tool-codegraph/load-bindings
 */

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { engineResult } from './driver.ts'
import type { CodegraphBindings, OpenedCodegraph } from './types.ts'

/** Minimal face of the CodeGraph class we open. */
interface CodeGraphCtor {
  open(root: string, options?: { readOnly?: boolean }): Promise<{ close?: () => void; destroy?: () => void }>
}

/** Minimal face of ToolHandler.execute. */
interface ToolHandlerInstance {
  execute(toolName: string, args: Record<string, unknown>): Promise<{
    content?: Array<{ type?: string; text?: string }>
    isError?: boolean
  }>
}

/**
 * Resolve CodeGraph / isInitialized / ToolHandler from the pinned npm package.
 * @param requireImpl - Node `require`; tests pass a fake, production uses `createRequire`.
 * @returns bindings the in-process driver can call.
 */
export function loadCodegraphBindings(requireImpl: NodeJS.Require = createRequire(import.meta.url)): CodegraphBindings {
  const root = requireImpl('@colbymchenry/codegraph') as {
    CodeGraph?: CodeGraphCtor
    default?: CodeGraphCtor
    isInitialized?: (root: string) => boolean
  }
  const CodeGraph = root.CodeGraph ?? root.default
  const isInitialized = root.isInitialized
  const ToolHandler = loadToolHandler(requireImpl)
  if (CodeGraph === undefined || isInitialized === undefined || ToolHandler === undefined) {
    throw new Error('bundled @colbymchenry/codegraph is missing CodeGraph, isInitialized, or ToolHandler')
  }
  return {
    isInitialized,
    async open(projectRoot: string): Promise<OpenedCodegraph> {
      const graph = await CodeGraph.open(projectRoot, { readOnly: true })
      const handler = new ToolHandler(graph)
      return {
        async execute(toolName, args) {
          const result = await handler.execute(toolName, args)
          const text = (result.content ?? [])
            .filter(block => block.type === 'text' && typeof block.text === 'string')
            .map(block => block.text)
            .join('\n')
          return engineResult(text, result.isError === true)
        },
        close() {
          if (typeof graph.close === 'function') graph.close()
          else graph.destroy?.()
        },
      }
    },
  }
}

/**
 * Load `ToolHandler` from the published platform bundle (or a source-tree
 * `dist/mcp` path a test double may still serve).
 * @param requireImpl - Node `require` rooted at this package.
 */
function loadToolHandler(
  requireImpl: NodeJS.Require,
): (new (graph: unknown) => ToolHandlerInstance) | undefined {
  try {
    const mcp = requireImpl('@colbymchenry/codegraph/dist/mcp/index.js') as {
      ToolHandler?: new (graph: unknown) => ToolHandlerInstance
    }
    if (mcp.ToolHandler !== undefined) return mcp.ToolHandler
  } catch {
    // The published package's `exports` omit this specifier.
  }
  try {
    const fromSdk = createRequire(requireImpl.resolve('@colbymchenry/codegraph'))
    const libPath = fromSdk.resolve(
      `@colbymchenry/codegraph-${process.platform}-${process.arch}/lib/dist/index.js`,
    )
    const mcp = fromSdk(join(dirname(libPath), 'mcp', 'index.js')) as {
      ToolHandler?: new (graph: unknown) => ToolHandlerInstance
    }
    return mcp.ToolHandler
  } catch {
    return undefined
  }
}
