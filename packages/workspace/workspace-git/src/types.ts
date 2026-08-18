/** One porcelain status entry. */
export interface GitStatusEntry {
  path: string
  index: string
  worktree: string
}

/** A compact Git commit graph row. */
export interface GitGraphEntry {
  hash: string
  parents: string[]
  subject: string
  refs: string[]
}
