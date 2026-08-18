import { useEffect, useState } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
interface Entry { path: string; name: string; directory: boolean; size: number }
interface Preview { path: string; content: string; truncated: boolean }
export interface WorkspaceInspectorInjected {
  tree: (workspaceId: string) => Promise<RemoteResult<Entry[]>>
  preview: (workspaceId: string, path: string) => Promise<RemoteResult<Preview>>
  workspaceId: () => string | undefined
}
/** Render a bounded local workspace file browser. */
export function WorkspaceInspectorSection({ t, tree, preview, workspaceId }: PropsLocale<'workspaceinspector'> & InjectFace<WorkspaceInspectorInjected>) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [selected, setSelected] = useState<Preview>()
  const [error, setError] = useState<string>()
  const id = workspaceId()
  useEffect(() => {
    if (id === undefined) return
    void tree(id).then(result => result.ok ? setEntries(result.value) : setError(result.error.message))
  }, [id, tree])
  return (
    <section>
      <h2>{t('title')}</h2>
      <p>{t('intro')}</p>
      {error !== undefined && <p role="alert">{error}</p>}
      <ul>{entries.map(entry => (
        <li key={entry.path}>{entry.directory ? entry.name : (
          <button type="button" onClick={() => {
            if (id !== undefined) {
              void preview(id, entry.path).then(result => result.ok ? setSelected(result.value) : setError(result.error.message))
            }
          }}>{entry.name}</button>
        )}</li>
      ))}</ul>
      {selected !== undefined && (
        <article>
          <h3>{selected.path}</h3>
          <pre>{selected.content}</pre>
          {selected.truncated && <p>Preview truncated.</p>}
        </article>
      )}
    </section>
  )
}
