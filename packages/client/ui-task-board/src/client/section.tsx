import { useEffect, useState } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
interface Task { id: string; title: string; archived: boolean }
export interface TaskBoardInjected {
  list: () => Promise<RemoteResult<Task[]>>
  create: (title: string, requestId: string) => Promise<RemoteResult<Task>>
  archive: (id: string, requestId: string) => Promise<RemoteResult<Task>>
}
/** Render and mutate the durable board through idempotent host actions. */
export function TaskBoardSection({ t, list, create, archive }: PropsLocale<'taskboard'> & InjectFace<TaskBoardInjected>) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string>()
  const refresh = (): void => { void list().then(result => result.ok ? setTasks(result.value) : setError(result.error.message)) }
  useEffect(refresh, [list])
  const requestId = (): string => crypto.randomUUID()
  return (
    <section>
      <h2>{t('title')}</h2>
      <p>{t('intro')}</p>
      <form onSubmit={(event) => {
        event.preventDefault()
        void create(title, requestId()).then((result) => {
          if (!result.ok) setError(result.error.message)
          else { setTitle(''); refresh() }
        })
      }}>
        <input aria-label="Task title" value={title} onChange={event => setTitle(event.target.value)} />
        <button type="submit">Add task</button>
      </form>
      {error !== undefined && <p role="alert">{error}</p>}
      <ul>{tasks.filter(task => !task.archived).map(task => (
        <li key={task.id}>{task.title} <button type="button" onClick={() => { void archive(task.id, requestId()).then(refresh) }}>Archive</button></li>
      ))}</ul>
    </section>
  )
}
