/**
 * Resolve the project root a CodeGraph call may open: the session workspace, or
 * a `projectPath` that stays inside that workspace.
 * @module @deepseek-ai/dsh-tool-codegraph/path
 */

import { isAbsolute, relative, resolve } from 'node:path'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'

/** The call has no session workspace, so no index root can be chosen. */
export class WorkspaceRequiredError extends Error {
  override name = 'WorkspaceRequiredError'

  constructor() {
    super('codegraph tools require a session workspace cwd')
  }
}

/** The requested `projectPath` resolved outside the session workspace. */
export class ProjectPathEscapeError extends Error {
  override name = 'ProjectPathEscapeError'

  /**
   * @param projectPath - the rejected requested path, after trim.
   */
  constructor(projectPath: string) {
    super(`projectPath must stay inside the session workspace (got ${JSON.stringify(projectPath)})`)
  }
}

/**
 * The session workspace cwd for this call, or `undefined` when none applies.
 * @param exec - the tool-execution context; only its optional `agent` is read.
 * @returns the calling agent's session cwd, or undefined for a non-agent caller.
 */
export function sessionCwd(exec: ToolExecution): string | undefined {
  return exec.agent?.session.header.cwd
}

/**
 * Resolve the project root for one call.
 * @param workspaceRoot - session cwd; required.
 * @param requested - optional model-supplied path, relative or absolute.
 * @returns the absolute project path.
 */
export function resolveProjectPath(workspaceRoot: string | undefined, requested: string | undefined): string {
  if (workspaceRoot === undefined) throw new WorkspaceRequiredError()
  const root = resolve(workspaceRoot)
  if (requested === undefined) return root
  const trimmed = requested.trim()
  if (trimmed.length === 0) return root
  const target = resolve(root, trimmed)
  const rel = relative(root, target)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new ProjectPathEscapeError(trimmed)
  return target
}
