import { useEffect, useState } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
interface Commit { hash: string; parents: string[]; subject: string; refs: string[] }
interface Status { path: string; index: string; worktree: string }
export interface GitGraphInjected {
  graph: (workspaceId: string) => Promise<RemoteResult<Commit[]>>
  status: (workspaceId: string) => Promise<RemoteResult<Status[]>>
  workspaceId: () => string | undefined
}
/** Render repository history and changes for one registered workspace. */
export function GitGraphSection({ t, graph, status, workspaceId }: PropsLocale<'gitgraph'> & InjectFace<GitGraphInjected>) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [changes, setChanges] = useState<Status[]>([])
  const [error, setError] = useState<string>()
  useEffect(() => {
    const id = workspaceId()
    if (id === undefined) return
    void Promise.all([graph(id), status(id)]).then(([history, worktree]) => {
      if (history.ok) setCommits(history.value)
      else setError(history.error.message)
      if (worktree.ok) setChanges(worktree.value)
      else setError(worktree.error.message)
    })
  }, [graph, status, workspaceId])
  return (
    <section>
      <h2>{t('title')}</h2>
      <p>{t('intro')}</p>
      {error !== undefined && <p role="alert">{error}</p>}
      <h3>Changes</h3>
      <ul>{changes.map(change => <li key={change.path}>{change.index}{change.worktree} {change.path}</li>)}</ul>
      <h3>History</h3>
      <ol>{commits.map(commit => <li key={commit.hash}><code>{commit.hash.slice(0, 12)}</code> {commit.subject}</li>)}</ol>
    </section>
  )
}
