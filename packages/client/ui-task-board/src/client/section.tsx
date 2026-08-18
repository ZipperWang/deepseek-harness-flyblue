/**
 * Task board settings section: create, rename, archive, and permanently delete
 * durable tasks through idempotent host actions. Mutations apply optimistically
 * and reconcile from the host's returned task view; refreshes carry a request
 * sequence so a stale list response cannot overwrite newer data.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import {
  Button, IconArchiveOutline20, IconChecklistOutline14, IconEditOutline16, IconLoadingOutline16,
  IconPlusOutline16, IconRefreshOutline16, Input, SegmentedRange,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import css from './section.module.css'

interface Task { id: string; title: string; archived: boolean; createdAt: number; updatedAt: number }

/** Remote dependency surface used by the task panel. */
export interface TaskBoardInjected {
  /** Read the durable task ledger. */
  list: () => Promise<RemoteResult<Task[]>>
  /** Create a task with a browser-minted idempotency key. */
  create: (title: string, requestId: string) => Promise<RemoteResult<Task>>
  /** Archive a task with an idempotency key. */
  archive: (id: string, requestId: string) => Promise<RemoteResult<Task>>
  /** Rename a task with an idempotency key. */
  update: (id: string, title: string, requestId: string) => Promise<RemoteResult<Task>>
  /** Permanently remove an archived task with an idempotency key. */
  remove: (id: string, requestId: string) => Promise<RemoteResult<Task>>
}

/** The two board tabs. */
export type TaskTab = 'active' | 'archived'

/**
 * Format a durable timestamp for one list row.
 * @param value - Milliseconds since the epoch.
 * @returns a locale-aware short date.
 */
export function formatDate(value: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

/**
 * Render the task board settings section.
 * @param props - locale and Remote verbs.
 * @returns the section element tree.
 */
export function TaskBoardSection({ t, list, create, archive, update, remove }: PropsLocale<'taskboard'> & InjectFace<TaskBoardInjected>) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [tab, setTab] = useState<TaskTab>('active')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set())
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [editingTitle, setEditingTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | undefined>(undefined)
  const sequence = useRef(0)
  const requestId = (): string => crypto.randomUUID()

  const refresh = useCallback(() => {
    const seq = ++sequence.current
    setBusy(true)
    setError(undefined)
    void list().then((result) => {
      if (seq !== sequence.current) return
      setBusy(false)
      if (result.ok) setTasks(result.value)
      else setError(result.error.message)
    })
  }, [list])

  useEffect(() => { refresh() }, [refresh])

  const activeCount = tasks.reduce((count, task) => count + (task.archived ? 0 : 1), 0)
  const archivedCount = tasks.length - activeCount
  const visible = tab === 'active'
    ? tasks.filter(task => !task.archived)
    : tasks.filter(task => task.archived)
  const firstLoad = busy && tasks.length === 0

  const submitCreate = (event: FormEvent): void => {
    event.preventDefault()
    const value = title.trim()
    if (value === '' || creating) return
    setCreating(true)
    void create(value, requestId()).then((result) => {
      setCreating(false)
      if (result.ok) { setTitle(''); setTasks(current => [...current, result.value]); refresh() }
      else setError(result.error.message)
    })
  }

  const archiveTask = (task: Task): void => {
    const previous = tasks
    setBusyIds(current => new Set(current).add(task.id))
    setTasks(current => current.map(candidate => candidate.id === task.id ? { ...candidate, archived: true } : candidate))
    void archive(task.id, requestId()).then((result) => {
      setBusyIds((current) => {
        const next = new Set(current)
        next.delete(task.id)
        return next
      })
      if (result.ok) {
        setTasks(current => current.map(candidate => candidate.id === result.value.id ? result.value : candidate))
        refresh()
      } else { setTasks(previous); setError(result.error.message) }
    })
  }

  const startEdit = (task: Task): void => {
    setEditingId(task.id)
    setEditingTitle(task.title)
  }

  const saveEdit = (): void => {
    const value = editingTitle.trim()
    if (editingId === undefined || value === '') return
    void update(editingId, value, requestId()).then((result) => {
      if (result.ok) {
        setEditingId(undefined)
        setTasks(current => current.map(candidate => candidate.id === result.value.id ? result.value : candidate))
        refresh()
      } else setError(result.error.message)
    })
  }

  const deleteTask = (task: Task): void => {
    const previous = tasks
    setBusyIds(current => new Set(current).add(task.id))
    void remove(task.id, requestId()).then((result) => {
      setBusyIds((current) => {
        const next = new Set(current)
        next.delete(task.id)
        return next
      })
      if (result.ok) {
        setConfirmDeleteId(undefined)
        setTasks(current => current.filter(candidate => candidate.id !== result.value.id))
        refresh()
      } else { setTasks(previous); setError(result.error.message) }
    })
  }

  return (
    <section className={css.section} data-task-board aria-busy={busy}>
      <header className={css.header}>
        <div>
          <h2 className={css.title}>{t('title')}</h2>
          <p className={css.intro}>{t('intro')}</p>
        </div>
        <div className={css.headerMeta}>
          <span className={css.counts}>{t('count.active').replace('{count}', String(activeCount))} · {t('count.archived').replace('{count}', String(archivedCount))}</span>
          <Button
            variant="ghost"
            size="sm"
            icon={busy ? <IconLoadingOutline16 className={css.spin} /> : <IconRefreshOutline16 />}
            disabled={busy}
            onClick={refresh}
            aria-label={t('refresh')}
          >
            {busy ? t('refreshing') : t('refresh')}
          </Button>
        </div>
      </header>
      {error !== undefined && (
        <div className={css.error} role="alert">
          <span>{t('error')}: {error}</span>
          <Button variant="ghost" size="sm" onClick={refresh}>{t('retry')}</Button>
        </div>
      )}
      <form className={css.createForm} onSubmit={submitCreate}>
        <Input
          icon={<IconPlusOutline16 />}
          placeholder={t('createPlaceholder')}
          aria-label={t('createAria')}
          value={title}
          onChange={(event) => { setTitle(event.target.value) }}
        />
        <Button type="submit" variant="primary" size="sm" disabled={title.trim() === '' || creating}>
          {t('create')}
        </Button>
      </form>
      <SegmentedRange
        aria-label={t('title')}
        value={tab}
        minWidth="88px"
        options={[
          { value: 'active', label: t('tab.active') },
          { value: 'archived', label: t('tab.archived') },
        ]}
        onChange={setTab}
      />
      {firstLoad
        ? <div className={css.skeleton} aria-busy="true" aria-label={t('loading')}><div className={css.skeletonRow} /><div className={css.skeletonRow} /><div className={css.skeletonRow} /></div>
        : visible.length === 0
          ? <div className={css.empty}>{t(tab === 'active' ? 'empty.active' : 'empty.archived')}</div>
          : (
            <ul className={css.list}>
              {visible.map((task, index) => {
                const pending = busyIds.has(task.id)
                const editing = editingId === task.id
                const confirmDelete = confirmDeleteId === task.id
                return (
                  <li key={task.id} className={css.row} style={{ '--row-index': index } as CSSProperties}>
                    {tab === 'active'
                      ? <IconChecklistOutline14 className={css.taskIcon} />
                      : <IconArchiveOutline20 className={css.taskIcon} />}
                    {editing
                      ? (
                        <form className={css.editForm} onSubmit={(event) => { event.preventDefault(); saveEdit() }}>
                          <Input
                            aria-label={t('renameAria')}
                            value={editingTitle}
                            onChange={(event) => { setEditingTitle(event.target.value) }}
                            autoFocus
                          />
                          <Button type="submit" size="sm" variant="primary" disabled={editingTitle.trim() === ''}>{t('renameSave')}</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(undefined) }}>{t('renameCancel')}</Button>
                        </form>
                      )
                      : (
                        <>
                          <span className={css.taskTitle} title={task.title}>{task.title}</span>
                          <span className={css.taskDate}>{formatDate(tab === 'active' ? task.createdAt : task.updatedAt)}</span>
                          <span className={css.actions}>
                            {tab === 'active' && (
                              <>
                                <Button size="sm" variant="ghost" disabled={pending} aria-label={t('rename')} onClick={() => { startEdit(task) }}>
                                  <IconEditOutline16 />
                                </Button>
                                <Button size="sm" variant="ghost" disabled={pending} onClick={() => { archiveTask(task) }}>
                                  {t('archive')}
                                </Button>
                              </>
                            )}
                            {tab === 'archived' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className={css.danger}
                                disabled={pending}
                                onClick={() => {
                                  if (confirmDeleteId === task.id) deleteTask(task)
                                  else setConfirmDeleteId(task.id)
                                }}
                              >
                                {confirmDelete ? t('deleteConfirm') : t('delete')}
                              </Button>
                            )}
                          </span>
                        </>
                      )}
                  </li>
                )
              })}
            </ul>
          )}
    </section>
  )
}
