/**
 * Host-owned workspace file inspection and mutations. Every operation starts
 * from a registered workspace id and rejects repository internals, traversal,
 * symbolic links, junctions, and stale version tokens.
 * @module @deepseek-ai/dsh-workspace-files
 */

import { open, lstat, mkdir, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-workspace'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { type FileVersion, FileVersion as createFileVersion, type WorkspaceFileEntry, type WorkspaceFilePreview } from './types.ts'

export { FileVersion } from './types.ts'
export type { WorkspaceFileEntry, WorkspaceFilePreview } from './types.ts'

/** Configures bounded filesystem reads and searches. */
export interface Config {
  /** Maximum bytes read for one text preview. */
  previewBytes?: number
  /** Maximum matching entries returned by one search. */
  searchResultLimit?: number
  /** Maximum filesystem entries examined by one search. */
  searchScanLimit?: number
}

/** Runtime schema for file limits. */
export const Config: z<Config> = z.object({
  previewBytes: z.natural().min(1).default(1_048_576),
  searchResultLimit: z.natural().min(1).default(200),
  searchScanLimit: z.natural().min(1).default(10_000),
})

declare module '@deepseek-ai/cordis' {
  interface Context { workspaceFiles: WorkspaceFilesService }
}

/**
 * Host service for ID-scoped file tree, preview, search, and mutations.
 * @typert service workspaceFiles
 */
export class WorkspaceFilesService extends TypertRemoteService {
  static inject = ['workspaceRegistry']

  /** @param ctx - Context carrying registered workspaces. @param config - bounded read limits. */
  constructor(ctx: Context, private readonly config: Config = {}) {
    super(ctx, 'workspaceFiles')
  }

  /**
   * List immediate children of one workspace-relative directory.
   * @param workspaceId - Registered workspace whose root authorizes the read.
   * @param path - Workspace-relative directory, or an empty string for the root.
   * @returns Direct children with stable metadata ordering.
   */
  @Remote({ authority: 'loopback' })
  async tree(workspaceId: WorkspaceId, path: string): Promise<WorkspaceFileEntry[]> {
    const target = await this.resolveExisting(workspaceId, path, true)
    const entries = await readdir(target, { withFileTypes: true })
    const output: WorkspaceFileEntry[] = []
    for (const entry of entries) {
      if (entry.name === '.git') continue
      const childPath = path === '' ? entry.name : `${path}/${entry.name}`
      const child = await this.resolveExisting(workspaceId, childPath)
      const info = await stat(child)
      output.push({ path: childPath, name: entry.name, directory: info.isDirectory(), size: info.size, version: createFileVersion(`${info.mtimeMs}:${info.size}`) })
    }
    return output.sort((left, right) => Number(right.directory) - Number(left.directory) || left.name.localeCompare(right.name))
  }

  /**
   * Read a bounded UTF-8 preview. Binary data is served only through a raw loopback route.
   * @param workspaceId - Registered workspace whose root authorizes the read.
   * @param path - Workspace-relative file path.
   * @returns Text preview and the version token required for a subsequent save.
   */
  @Remote({ authority: 'loopback' })
  async preview(workspaceId: WorkspaceId, path: string): Promise<WorkspaceFilePreview> {
    const target = await this.resolveExisting(workspaceId, path)
    const info = await stat(target)
    if (info.isDirectory()) throw new Error('workspace-files: cannot preview a directory')
    const cap = this.config.previewBytes ?? 1_048_576
    const handle = await open(target, 'r')
    const bytes = Buffer.alloc(Math.min(info.size, cap))
    try {
      await handle.read(bytes, 0, bytes.byteLength, 0)
    } finally {
      await handle.close()
    }
    const content = bytes.subarray(0, cap).toString('utf8')
    return { path, content, truncated: bytes.byteLength > cap, version: createFileVersion(`${info.mtimeMs}:${info.size}`) }
  }

  /**
   * Save text only when the browser's version token still matches disk.
   * @param workspaceId - Registered workspace whose root authorizes the write.
   * @param path - Workspace-relative file path.
   * @param content - Complete UTF-8 replacement text.
   * @param version - Version returned by the latest preview.
   * @returns The saved file's current preview and replacement version token.
   */
  @Remote({ authority: 'loopback' })
  async save(workspaceId: WorkspaceId, path: string, content: string, version: FileVersion): Promise<WorkspaceFilePreview> {
    const target = await this.resolveExisting(workspaceId, path)
    const before = await stat(target)
    if (createFileVersion(`${before.mtimeMs}:${before.size}`) !== version) throw new Error('workspace-files: stale-write')
    await writeFile(target, content, 'utf8')
    return this.preview(workspaceId, path)
  }

  /**
   * Search names without following links or walking Git internals.
   * @param workspaceId - Registered workspace whose root authorizes the search.
   * @param query - Case-insensitive filename fragment.
   * @returns Matching entries up to the configured result and scan limits.
   */
  @Remote({ authority: 'loopback' })
  async search(workspaceId: WorkspaceId, query: string): Promise<WorkspaceFileEntry[]> {
    const needle = query.trim().toLowerCase()
    if (needle === '') return []
    const root = await this.root(workspaceId)
    const limit = this.config.searchResultLimit ?? 200
    const scanLimit = this.config.searchScanLimit ?? 10_000
    const result: WorkspaceFileEntry[] = []
    let scanned = 0
    const walk = async (directory: string, prefix: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (scanned++ >= scanLimit || result.length >= limit || entry.name === '.git') return
        const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`
        const target = await this.resolveExisting(workspaceId, path)
        const info = await stat(target)
        if (entry.name.toLowerCase().includes(needle)) result.push({ path, name: entry.name, directory: info.isDirectory(), size: info.size, version: createFileVersion(`${info.mtimeMs}:${info.size}`) })
        if (info.isDirectory()) await walk(target, path)
      }
    }
    await walk(root, '')
    return result
  }

  /**
   * Rename a relative path after an explicit destructive confirmation.
   * @param workspaceId - Registered workspace whose root authorizes the mutation.
   * @param path - Existing workspace-relative source path.
   * @param name - Replacement basename without path separators.
   * @param confirmed - Explicit confirmation required before the rename.
   */
  @Remote({ authority: 'loopback' })
  async rename(workspaceId: WorkspaceId, path: string, name: string, confirmed: boolean): Promise<void> {
    if (!confirmed) throw new Error('workspace-files: confirmation-required')
    if (name === '' || name === '.' || name === '..' || /[\\/]/.test(name)) throw new Error('workspace-files: invalid name')
    const source = await this.resolveExisting(workspaceId, path)
    const target = resolve(dirname(source), name)
    await this.assertInside(await this.root(workspaceId), target)
    await rename(source, target)
  }

  /**
   * Create an empty file, refusing to overwrite an existing path.
   * @param workspaceId - Registered workspace whose root authorizes the mutation.
   * @param path - New workspace-relative file path.
   */
  @Remote({ authority: 'loopback' })
  async create(workspaceId: WorkspaceId, path: string): Promise<void> {
    const target = await this.resolveNew(workspaceId, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, '', { encoding: 'utf8', flag: 'wx' })
  }

  /**
   * Delete a path only after an explicit confirmation.
   * @param workspaceId - Registered workspace whose root authorizes the mutation.
   * @param path - Existing workspace-relative path to remove.
   * @param confirmed - Explicit confirmation required before deletion.
   */
  @Remote({ authority: 'loopback' })
  async remove(workspaceId: WorkspaceId, path: string, confirmed: boolean): Promise<void> {
    if (!confirmed) throw new Error('workspace-files: confirmation-required')
    await rm(await this.resolveExisting(workspaceId, path), { recursive: true, force: false })
  }

  private async root(workspaceId: WorkspaceId): Promise<string> {
    const workspace = this.ctx.workspaceRegistry.get(workspaceId)
    if (workspace === undefined) throw new Error('workspace-files: unknown workspace')
    return realpath(workspace.path)
  }

  private async resolveExisting(workspaceId: WorkspaceId, path: string, directory = false): Promise<string> {
    const root = await this.root(workspaceId)
    if (path === '') {
      if (!directory) throw new Error('workspace-files: expected a file path')
      return root
    }
    const target = await this.resolveRelative(root, path)
    const info = await lstat(target)
    if (info.isSymbolicLink()) throw new Error('workspace-files: symbolic links are not accessible')
    await this.assertRealInside(root, target)
    if (directory && !info.isDirectory()) throw new Error('workspace-files: expected directory')
    return target
  }

  private async resolveNew(workspaceId: WorkspaceId, path: string): Promise<string> {
    const root = await this.root(workspaceId)
    const target = await this.resolveRelative(root, path)
    const parent = await realpath(dirname(target))
    await this.assertInside(root, parent)
    return target
  }

  private async resolveRelative(root: string, path: string): Promise<string> {
    if (path === '' || path.split(/[\\/]/).includes('.git')) throw new Error('workspace-files: invalid relative path')
    const target = resolve(root, path)
    await this.assertInside(root, target)
    const pieces = relative(root, target).split(sep)
    let current = root
    for (const piece of pieces) {
      current = resolve(current, piece)
      try {
        const info = await lstat(current)
        if (info.isSymbolicLink()) throw new Error('workspace-files: symbolic links are not accessible')
        await this.assertRealInside(root, current)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') break
        throw error
      }
    }
    return target
  }

  private async assertInside(root: string, target: string): Promise<void> {
    const rel = relative(root, target)
    if (rel === '' || rel.startsWith(`..${sep}`) || rel === '..' || resolve(root, rel) !== target) throw new Error('workspace-files: path escapes workspace')
  }

  /** Reject a Windows junction or any other reparse point that resolves outside the workspace. */
  private async assertRealInside(root: string, target: string): Promise<void> {
    await this.assertInside(root, await realpath(target))
  }
}

export default WorkspaceFilesService
