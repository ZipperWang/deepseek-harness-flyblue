import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import {
  ProjectPathEscapeError,
  resolveProjectPath,
  sessionCwd,
  WorkspaceRequiredError,
} from '@deepseek-ai/dsh-tool-codegraph'

const root = resolve('/virtual/workspace')

describe('resolveProjectPath', () => {
  it('requires a session workspace', () => {
    expect(() => resolveProjectPath(undefined, undefined)).toThrow(WorkspaceRequiredError)
  })

  it('defaults to the resolved workspace and ignores blank projectPath', () => {
    expect(resolveProjectPath(root, undefined)).toBe(root)
    expect(resolveProjectPath(root, '   ')).toBe(root)
  })

  it('resolves a relative projectPath inside the workspace', () => {
    expect(resolveProjectPath(root, 'packages/app')).toBe(resolve(root, 'packages/app'))
  })

  it('rejects a projectPath that escapes the workspace', () => {
    expect(() => resolveProjectPath(root, '..')).toThrow(ProjectPathEscapeError)
    expect(() => resolveProjectPath(root, '..')).toThrow(/stay inside the session workspace/)
  })
})

describe('sessionCwd', () => {
  it('reads the agent session cwd and ignores a non-agent caller', () => {
    expect(sessionCwd({ agent: { session: { header: { cwd: root } } } } as never)).toBe(root)
    expect(sessionCwd({} as never)).toBeUndefined()
  })
})
