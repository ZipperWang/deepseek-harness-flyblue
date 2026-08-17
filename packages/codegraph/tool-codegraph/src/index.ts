/**
 * Model-facing CodeGraph tools over the bundled `@colbymchenry/codegraph`
 * engine. Registration does not require an index: missing `.codegraph/` or a
 * failed engine load returns success-shaped guidance instead of failing preset
 * mount. Namespace plugin (named exports, no default export).
 * @module @deepseek-ai/dsh-tool-codegraph
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import {
  createInProcessDriver,
  createSubprocessDriver,
  nodeMajor,
  resolveIsolation,
} from './driver.ts'
import { EXTRA_TOOLS, resolveExtraTools } from './extra-tools.ts'
import { loadCodegraphBindings } from './load-bindings.ts'
import { resolveProjectPath, sessionCwd } from './path.ts'
import { presentCodegraphCall } from './present.ts'
import { CODEGRAPH_PROMPT_TEXT } from './prompt.ts'
import { createSpawnRunner } from './spawn-runner.ts'
import type {
  CodegraphDriver,
  CodegraphExtraToolId,
  CodegraphIsolation,
  CodegraphToolValue,
} from './types.ts'

export type {
  CodegraphBindings,
  CodegraphDriver,
  CodegraphEngineResult,
  CodegraphExtraToolId,
  CodegraphIsolation,
  CodegraphProcessRunner,
  CodegraphToolValue,
  OpenedCodegraph,
} from './types.ts'
export { CODEGRAPH_PROMPT_TEXT } from './prompt.ts'
export {
  buildCliArgv,
  createInProcessDriver,
  createSubprocessDriver,
  ENGINE_UNAVAILABLE_TEXT,
  looksUnindexed,
  nodeMajor,
  notIndexedText,
  resolveIsolation,
  UNSAFE_NODE_MAJOR,
} from './driver.ts'
export { EXTRA_TOOL_IDS, EXTRA_TOOLS, resolveExtraTools } from './extra-tools.ts'
export { loadCodegraphBindings } from './load-bindings.ts'
export { ProjectPathEscapeError, resolveProjectPath, sessionCwd, WorkspaceRequiredError } from './path.ts'
export { presentCodegraphCall } from './present.ts'
export { createSpawnRunner, resolveCodegraphCli } from './spawn-runner.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-codegraph'

/** Services required by the CodeGraph tool suite. */
export const inject = ['tools', 'systemPrompt']

/** Default cooperative tool-call timeout budget (ms). */
export const DEFAULT_CODEGRAPH_TOOL_TIMEOUT_MS = 60_000

/**
 * CodeGraph tools are read-only against the index and may overlap.
 * @returns true.
 */
export function codegraphIsConcurrencySafe(): boolean {
  return true
}

/** Plugin configuration: extra tools, isolation, and the timeout budget. */
export interface Config {
  /**
   * Extra short names to list besides `explore`. Empty by default because a
   * single primary tool steers better than a menu of narrower ones.
   */
  extraTools?: string[]
  /**
   * How to run the bundled engine. `auto` uses in-process below Node 25 and a
   * child process at Node 25+, where tree-sitter WASM can OOM the host.
   */
  isolation?: CodegraphIsolation
  /** Tool-call timeout budget in ms (default 60000). */
  timeoutMs?: number
}

/** Schemastery configuration for the CodeGraph tool consumer. */
export const Config: z<Config> = z.object({
  extraTools: z.array(z.string()).default([]),
  isolation: z.union(['auto', 'in-process', 'subprocess'] as const).default('auto'),
  timeoutMs: z.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_CODEGRAPH_TOOL_TIMEOUT_MS),
})

/** Complete config after schemastery applies every field default. */
type ResolvedConfig = Required<Config>

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string', required: true },
    projectPath: { type: 'string', required: true },
    indexed: { type: 'boolean', required: true },
  },
} as const

/**
 * Register the tools against an already-constructed driver. Tests inject a
 * fake driver so they do not load the engine.
 * @param ctx - context whose `tools` and `systemPrompt` receive registrations.
 * @param config - resolved plugin configuration.
 * @param driver - engine used by every registered tool.
 */
export function applyWithDriver(ctx: Context, config: ResolvedConfig, driver: CodegraphDriver): void {
  assertTimer('timeoutMs', config.timeoutMs)
  const extras = resolveExtraTools(config.extraTools)
  ctx.effect(() => () => {
    driver.dispose()
  })
  ctx.systemPrompt.section({ name: 'tool:codegraph', order: 108, text: CODEGRAPH_PROMPT_TEXT })

  ctx.tools.register(defineTool({
    name: 'codegraph_explore',
    description:
      'PRIMARY TOOL — call FIRST for almost any question OR before an edit: how does X work, architecture, a bug, '
      + 'where/what is X, surveying an area, or the symbols you are about to change. Returns the verbatim source of '
      + 'the relevant symbols grouped by file in ONE capped call (Read-equivalent — treat the shown source as already '
      + 'Read; do NOT re-open those files), plus the call path among them. Query can be a natural-language question OR '
      + 'a bag of symbol/file names. Usually the ONLY call you need.',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description:
          'Symbol names, file names, or a short question (e.g. "AuthService loginUser", "how does X reach Y").',
      },
      maxFiles: {
        type: 'number',
        description: 'Maximum number of files to include source from (engine default applies when omitted).',
      },
      projectPath: {
        type: 'string',
        description: 'Project root that has a `.codegraph/` index. Defaults to the session workspace.',
      },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    timeoutMs: config.timeoutMs,
    isConcurrencySafe: codegraphIsConcurrencySafe,
    async execute(args, exec) {
      return runTool(driver, 'codegraph_explore', {
        query: args.query,
        ...typeof args.maxFiles === 'number' ? { maxFiles: args.maxFiles } : {},
        ...typeof args.projectPath === 'string' ? { projectPath: args.projectPath } : {},
      }, exec)
    },
    presentCall: args => presentCodegraphCall(args, 'codegraph_explore'),
  }))

  for (const id of extras) {
    registerExtraTool(ctx, driver, id, config.timeoutMs)
  }
}

/**
 * Register the enabled CodeGraph tools. The driver is chosen from `isolation`
 * and constructed here so a missing engine cannot fail plugin activation.
 * @param ctx - plugin context (must inject `tools` and `systemPrompt`).
 * @param config - the resolved plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  const isolation = resolveIsolation(resolved.isolation, nodeMajor())
  const driver = isolation === 'subprocess'
    ? createSubprocessDriver(createSpawnRunner())
    : createInProcessDriver(loadCodegraphBindings)
  applyWithDriver(ctx, resolved, driver)
}

/**
 * Register one extra tool from the closed catalog.
 * @param ctx - plugin context.
 * @param driver - shared engine.
 * @param id - extra short name.
 * @param timeoutMs - cooperative timeout budget.
 */
function registerExtraTool(
  ctx: Context,
  driver: CodegraphDriver,
  id: CodegraphExtraToolId,
  timeoutMs: number,
): void {
  const extra = EXTRA_TOOLS[id]
  ctx.tools.register(defineTool({
    name: extra.name,
    description: extra.description,
    parameters: extra.parameters as never,
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    timeoutMs,
    isConcurrencySafe: codegraphIsConcurrencySafe,
    async execute(args, exec) {
      return runTool(driver, extra.name, args as Record<string, unknown>, exec)
    },
    presentCall: args => presentCodegraphCall(args as { query?: string }, extra.name),
  }))
}

/**
 * Resolve the project root, dispatch the engine, and wrap a successful body.
 * Engine `isError` (path refusal or malfunction) throws so the registry marks
 * the call as an error; an unindexed project stays a successful value.
 * @param driver - engine.
 * @param toolName - full tool name.
 * @param args - model arguments, possibly including `projectPath`.
 * @param exec - execution context.
 */
async function runTool(
  driver: CodegraphDriver,
  toolName: string,
  args: Record<string, unknown>,
  exec: ToolExecution,
): Promise<CodegraphToolValue> {
  const projectPath = resolveProjectPath(
    sessionCwd(exec),
    typeof args.projectPath === 'string' ? args.projectPath : undefined,
  )
  const result = await driver.execute(toolName, { ...args, projectPath }, exec.signal)
  if (result.isError) throw new Error(result.text)
  return { text: result.text, projectPath, indexed: result.indexed }
}

/** Reject a timer value Node would clamp instead of scheduling as configured. */
function assertTimer(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > MAX_TIMER_DELAY_MS) {
    throw new Error(`tool-codegraph: ${name} must be an integer between 1 and ${MAX_TIMER_DELAY_MS}`)
  }
}
