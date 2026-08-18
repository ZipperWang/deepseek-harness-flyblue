/** Workspace-ID scoped Git operations used by graph and file-change clients. */
import { execFile } from 'node:child_process'
import { lstat } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-workspace'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { GitGraphEntry, GitStatusEntry } from './types.ts'

export type { GitGraphEntry, GitStatusEntry } from './types.ts'

/** Limits Git process duration and graph size. */
export interface Config {
  /** Maximum duration in milliseconds for one Git subprocess. */
  timeoutMs?: number
  /** Maximum commits returned by one graph request. */
  graphLimit?: number
}
/** Runtime schema for Git limits. */
export const Config: z<Config> = z.object({ timeoutMs: z.natural().min(1).default(20_000), graphLimit: z.natural().min(1).default(500) })
declare module '@deepseek-ai/cordis' { interface Context { workspaceGit: WorkspaceGitService } }

/**
 * Host service for the shared Git state used by graph and file-change panels.
 * @typert service workspaceGit
 */
export class WorkspaceGitService extends TypertRemoteService {
  static inject = ['workspaceRegistry']
  /** @param ctx - Context carrying registered workspaces. @param config - Git execution limits. */
  constructor(ctx: Context, private readonly config: Config = {}) { super(ctx, 'workspaceGit') }

  /**
   * Read working-tree status.
   * @param workspaceId - Registered workspace containing the repository.
   * @returns Porcelain status entries for index and working-tree changes.
   */
  @Remote({ authority: 'loopback' })
  async status(workspaceId: WorkspaceId): Promise<GitStatusEntry[]> {
    const output = await this.git(workspaceId, ['status', '--porcelain=v1', '-z'])
    return output.split('\0').filter(Boolean).map(line => ({ index: line.slice(0, 1), worktree: line.slice(1, 2), path: line.slice(3) }))
  }

  /**
   * List local branches and the current branch.
   * @param workspaceId - Registered workspace containing the repository.
   * @returns Local branch names and the current branch when attached.
   */
  @Remote({ authority: 'loopback' })
  async branches(workspaceId: WorkspaceId): Promise<{ current: string | null; branches: string[] }> {
    const output = await this.git(workspaceId, ['branch', '--format=%(HEAD)%(refname:short)'])
    let current: string | null = null
    const branches = output.split(/\r?\n/).filter(Boolean).map((line) => {
      if (line.startsWith('*')) { current = line.slice(1); return line.slice(1) }
      return line.trim()
    })
    return { current, branches }
  }

  /**
   * Read a bounded commit graph without exposing arbitrary process execution.
   * @param workspaceId - Registered workspace containing the repository.
   * @returns Commit rows up to the configured graph limit.
   */
  @Remote({ authority: 'loopback' })
  async graph(workspaceId: WorkspaceId): Promise<GitGraphEntry[]> {
    const output = await this.git(workspaceId, ['log', `--max-count=${this.config.graphLimit ?? 500}`, '--format=%H%x1f%P%x1f%D%x1f%s'])
    return output.split(/\r?\n/).filter(Boolean).map((line) => {
      const [hash = '', parentText = '', refText = '', subject = ''] = line.split('\x1f')
      return { hash, parents: parentText === '' ? [] : parentText.split(' '), refs: refText === '' ? [] : refText.split(', '), subject }
    })
  }

  /**
   * Create a branch at the current HEAD.
   * @param workspaceId - Registered workspace containing the repository.
   * @param name - New local branch name interpreted by Git.
   */
  @Remote({ authority: 'loopback' })
  createBranch(workspaceId: WorkspaceId, name: string): Promise<void> { return this.git(workspaceId, ['branch', name]).then(() => undefined) }

  /**
   * Switch only when no merge/rebase/cherry-pick is active and the tree is clean.
   * @param workspaceId - Registered workspace containing the repository.
   * @param name - Existing local branch name.
   */
  @Remote({ authority: 'loopback' })
  async switchBranch(workspaceId: WorkspaceId, name: string): Promise<void> {
    if ((await this.status(workspaceId)).length > 0) throw new Error('workspace-git: working tree is not clean')
    if (await this.operationInProgress(workspaceId)) throw new Error('workspace-git: another Git operation is in progress')
    const branches = await this.branches(workspaceId)
    if (!branches.branches.includes(name)) throw new Error('workspace-git: unknown branch')
    const worktrees = await this.git(workspaceId, ['worktree', 'list', '--porcelain'])
    if (worktrees.split(/\r?\n/).some(line => line === `branch refs/heads/${name}`)) {
      const currentPath = this.workspacePath(workspaceId)
      const blocks = worktrees.split(/\r?\n\r?\n/)
      if (blocks.some(block => block.includes(`branch refs/heads/${name}`) && !block.includes(`worktree ${currentPath}`))) {
        throw new Error('workspace-git: branch is checked out by another worktree')
      }
    }
    await this.git(workspaceId, ['switch', name])
  }

  /**
   * Stage one workspace-relative path.
   * @param workspaceId - Registered workspace containing the repository.
   * @param path - Workspace-relative path passed after Git's option separator.
   */
  @Remote({ authority: 'loopback' })
  stage(workspaceId: WorkspaceId, path: string): Promise<void> { return this.git(workspaceId, ['add', '--', this.relativePath(path)]).then(() => undefined) }
  /**
   * Remove one path from the index.
   * @param workspaceId - Registered workspace containing the repository.
   * @param path - Workspace-relative path passed after Git's option separator.
   */
  @Remote({ authority: 'loopback' })
  unstage(workspaceId: WorkspaceId, path: string): Promise<void> { return this.git(workspaceId, ['restore', '--staged', '--', this.relativePath(path)]).then(() => undefined) }
  /**
   * Discard one tracked file only after explicit confirmation.
   * @param workspaceId - Registered workspace containing the repository.
   * @param path - Workspace-relative tracked file path.
   * @param confirmed - Explicit confirmation required before discarding changes.
   */
  @Remote({ authority: 'loopback' })
  discard(workspaceId: WorkspaceId, path: string, confirmed: boolean): Promise<void> {
    if (!confirmed) return Promise.reject(new Error('workspace-git: confirmation-required'))
    return this.git(workspaceId, ['restore', '--worktree', '--', this.relativePath(path)]).then(() => undefined)
  }

  private relativePath(path: string): string {
    if (path === '' || path.startsWith('-') || path.split(/[\\/]/).some(part => part === '..' || part === '.git')) throw new Error('workspace-git: invalid relative path')
    return path
  }
  private async git(workspaceId: WorkspaceId, args: string[]): Promise<string> {
    const path = this.workspacePath(workspaceId)
    return new Promise((resolveResult, reject) => {
      execFile('git', args, { cwd: path, timeout: this.config.timeoutMs ?? 20_000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error !== null) reject(new Error(`workspace-git: ${stderr.trim() || error.message}`))
        else resolveResult(stdout)
      })
    })
  }
  private workspacePath(workspaceId: WorkspaceId): string {
    const workspace = this.ctx.workspaceRegistry.get(workspaceId)
    if (workspace === undefined) throw new Error('workspace-git: unknown workspace')
    return workspace.path
  }
  private async operationInProgress(workspaceId: WorkspaceId): Promise<boolean> {
    // A missing MERGE_HEAD is normal; the remaining state files are checked
    // with one shell-free Git probe so branch switching cannot cross an
    // incomplete merge, rebase, cherry-pick, or revert.
    const states = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']
    for (const state of states) {
      const path = (await this.git(workspaceId, ['rev-parse', '--git-path', state])).trim()
      try {
        await lstat(path)
        return true
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
    return false
  }
}
export default WorkspaceGitService
