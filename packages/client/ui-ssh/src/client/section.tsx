/**
 * SSH operations settings section: manage loopback-only host records and run a
 * deliberate command console. Mutations reconcile from the host's returned
 * summaries; the console appends one terminal block per executed command and
 * warns when a dispatched result stays unknown.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import {
  Button, IconLoadingOutline16, IconPlayOutline16, IconPlusOutline16, IconRefreshOutline16,
  IconTrashOutline16, Input, TerminalBlock, type TerminalBlockLabels,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import css from './section.module.css'

/** Secret-free host projection used by the section. */
export interface HostSummary { id: string; alias: string; host: string; port: number; user: string; auth: 'password' | 'key' }
/** Complete host record accepted by the put verb. */
export interface HostRecord {
  id: string
  alias: string
  host: string
  port: number
  user: string
  password?: string
  privateKeyPath?: string
}
/** One console entry: the command and its lifecycle on this host. */
export interface ExecEntry { command: string; running: boolean; stdout: string; stderr: string; exitCode: number | null; result: 'known' | 'result-unknown' }

/** Remote dependency surface used by the SSH panel. */
export interface SshInjected {
  /** Read secret-free host records. */
  list: () => Promise<RemoteResult<HostSummary[]>>
  /** Insert or replace a complete host record. */
  put: (host: HostRecord) => Promise<RemoteResult<HostSummary>>
  /** Remove a host record. */
  remove: (id: string) => Promise<RemoteResult<void>>
  /** Execute one command once against a host. */
  exec: (id: string, command: string) => Promise<RemoteResult<{ stdout: string; stderr: string; exitCode: number | null; result: 'known' | 'result-unknown' }>>
}

/** Which authentication mode the host form edits. */
export type AuthMode = 'password' | 'key'

/**
 * Localized TerminalBlock copy for this section's dictionaries.
 * @param t - the ssh locale seat.
 * @returns the full label set {@link TerminalBlock} requires.
 */
export function terminalLabels(t: PropsLocale<'ssh'>['t']): TerminalBlockLabels {
  return {
    signal: value => t('termSignal').replace('{signal}', value),
    exitCode: value => t('termExit').replace('{code}', String(value)),
    running: t('termRunning'),
    failed: t('termFailed'),
    done: t('termDone'),
    copy: t('termCopy'),
    copied: t('termCopied'),
    noOutput: t('termNoOutput'),
    collapseAria: t('termCollapseAria'),
    collapse: t('termCollapse'),
    expandAria: hidden => t('termExpandAria').replace('{hidden}', String(hidden)),
    expand: hidden => t('termExpand').replace('{hidden}', String(hidden)),
  }
}

/**
 * Render the SSH operations settings section.
 * @param props - locale and Remote verbs.
 * @returns the section element tree.
 */
export function SshSection({ t, list, put, remove, exec }: PropsLocale<'ssh'> & InjectFace<SshInjected>) {
  const [hosts, setHosts] = useState<HostSummary[]>([])
  const [hostId, setHostId] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | undefined>(undefined)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [alias, setAlias] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('22')
  const [user, setUser] = useState('')
  const [auth, setAuth] = useState<AuthMode>('password')
  const [secret, setSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [command, setCommand] = useState('')
  const [running, setRunning] = useState(false)
  const [entries, setEntries] = useState<ExecEntry[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const sequence = useRef(0)

  /** Apply one list response under the current sequence; clears busy and fixes selection. */
  const applyList = useCallback((seq: number, result: RemoteResult<HostSummary[]>, preferId?: string) => {
    if (seq !== sequence.current) return
    setBusy(false)
    if (result.ok) {
      setHosts(result.value)
      setHostId((current) => {
        if (preferId !== undefined) return preferId
        return result.value.some(candidate => candidate.id === current) ? current : result.value[0]?.id
      })
    } else setError(result.error.message)
  }, [])

  const refresh = useCallback(() => {
    const seq = ++sequence.current
    setBusy(true)
    setError(undefined)
    void list().then((result) => { applyList(seq, result) })
  }, [list, applyList])

  /** Re-read the inventory after a mutation; bumps the sequence so in-flight responses go stale. */
  const reload = useCallback((preferId?: string) => {
    const seq = ++sequence.current
    setError(undefined)
    void list().then((result) => { applyList(seq, result, preferId) })
  }, [list, applyList])

  useEffect(() => { refresh() }, [refresh])

  const selected = hosts.find(candidate => candidate.id === hostId)
  const firstLoad = busy && hosts.length === 0

  const openAddForm = (): void => {
    setEditingId(undefined)
    setAlias(''); setHost(''); setPort('22'); setUser(''); setAuth('password'); setSecret('')
    setFormOpen(true)
  }

  const openEditForm = (summary: HostSummary): void => {
    setEditingId(summary.id)
    setAlias(summary.alias); setHost(summary.host); setPort(String(summary.port)); setUser(summary.user); setAuth(summary.auth); setSecret('')
    setFormOpen(true)
  }

  const submitHost = (event: FormEvent): void => {
    event.preventDefault()
    if (saving) return
    const record: HostRecord = {
      id: editingId ?? crypto.randomUUID(),
      alias: alias.trim(),
      host: host.trim(),
      port: Number(port),
      user: user.trim(),
      ...(auth === 'password' ? { password: secret } : { privateKeyPath: secret.trim() }),
    }
    setSaving(true)
    void put(record).then((result) => {
      setSaving(false)
      if (result.ok) {
        setFormOpen(false)
        reload(result.value.id)
      } else setError(result.error.message)
    })
  }

  const deleteHost = (id: string): void => {
    setConfirmDeleteId(undefined)
    void remove(id).then((result) => {
      if (result.ok) reload()
      else setError(result.error.message)
    })
  }

  const run = (): void => {
    const value = command.trim()
    if (value === '' || hostId === undefined || running) return
    setEntries(current => [...current, { command: value, running: true, stdout: '', stderr: '', exitCode: null, result: 'known' }])
    setCommand('')
    setHistory(current => [...current, value])
    setHistoryIndex(-1)
    setRunning(true)
    void exec(hostId, value).then((result) => {
      setRunning(false)
      setEntries(current => current.map((candidate, index) => {
        if (index !== current.length - 1) return candidate
        if (!result.ok) return { ...candidate, running: false }
        return {
          ...candidate,
          running: false,
          stdout: result.value.stdout,
          stderr: result.value.stderr,
          exitCode: result.value.exitCode,
          result: result.value.result,
        }
      }))
      if (!result.ok) setError(result.error.message)
    })
  }

  const recall = (direction: -1 | 1): void => {
    const from = historyIndex === -1 ? history.length : historyIndex
    const next = from + direction
    if (next < 0 || next > history.length) return
    setHistoryIndex(next === history.length ? -1 : next)
    if (next === history.length) setCommand('')
    else {
      const recalled = history[next]
      /* v8 ignore next -- next is clamped to a history index */
      setCommand(recalled ?? '')
    }
  }

  const clearOutput = (): void => { setEntries([]) }

  const labels = terminalLabels(t)

  return (
    <section className={css.section} data-ssh aria-busy={busy}>
      <header className={css.header}>
        <div>
          <h2 className={css.title}>{t('title')}</h2>
          <p className={css.intro}>{t('intro')}</p>
        </div>
        <div className={css.headerMeta}>
          <span className={css.counts}>{t('count.hosts').replace('{count}', String(hosts.length))}</span>
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
      <article className={css.card}>
        <div className={css.cardHeader}>
          <h3 className={css.cardTitle}>{t('hosts')}</h3>
          <Button size="sm" variant="ghost" icon={<IconPlusOutline16 />} onClick={openAddForm}>{t('addHost')}</Button>
        </div>
        {firstLoad
          ? <div className={css.skeleton} aria-busy="true" aria-label={t('loading')}><div className={css.skeletonRow} /><div className={css.skeletonRow} /></div>
          : hosts.length === 0
            ? <div className={css.empty}>{t('noHosts')}</div>
            : (
              <ul className={css.list}>
                {hosts.map((summary, index) => {
                  const active = summary.id === hostId
                  const deleting = confirmDeleteId === summary.id
                  return (
                    <li key={summary.id} className={css.row} style={{ '--row-index': index } as CSSProperties}>
                      <button
                        type="button"
                        className={css.hostSelect}
                        aria-pressed={active}
                        disabled={running}
                        onClick={() => { setHostId(summary.id) }}
                      >
                        <span className={css.hostAlias}>{summary.alias}</span>
                        <span className={css.hostAddress}>{summary.user}@{summary.host}:{summary.port}</span>
                        <span className={summary.auth === 'password' ? css.authPassword : css.authKey}>
                          {summary.auth === 'password' ? t('auth.password') : t('auth.key')}
                        </span>
                      </button>
                      <span className={css.actions}>
                        <Button size="sm" variant="ghost" onClick={() => { openEditForm(summary) }}>{t('editHost')}</Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={css.danger}
                          onClick={() => {
                            if (deleting) deleteHost(summary.id)
                            else setConfirmDeleteId(summary.id)
                          }}
                        >
                          {deleting ? t('deleteHostConfirm') : t('deleteHost')}
                        </Button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
        {formOpen && (
          <form className={css.hostForm} onSubmit={submitHost} aria-label={editingId === undefined ? t('addHost') : t('editHost')}>
            <div className={css.formGrid}>
              <Input aria-label={t('field.alias')} placeholder={t('field.alias')} value={alias} onChange={(event) => { setAlias(event.target.value) }} />
              <Input aria-label={t('field.host')} placeholder={t('field.host')} value={host} onChange={(event) => { setHost(event.target.value) }} />
              <Input aria-label={t('field.port')} placeholder={t('field.port')} value={port} onChange={(event) => { setPort(event.target.value) }} />
              <Input aria-label={t('field.user')} placeholder={t('field.user')} value={user} onChange={(event) => { setUser(event.target.value) }} />
            </div>
            <div className={css.range}>
              <button type="button" aria-pressed={auth === 'password'} onClick={() => { setAuth('password') }}>{t('auth.password')}</button>
              <button type="button" aria-pressed={auth === 'key'} onClick={() => { setAuth('key') }}>{t('auth.key')}</button>
            </div>
            <Input
              aria-label={auth === 'password' ? t('field.password') : t('field.keyPath')}
              placeholder={auth === 'password' ? t('field.password') : t('field.keyPath')}
              type={auth === 'password' ? 'password' : 'text'}
              value={secret}
              onChange={(event) => { setSecret(event.target.value) }}
            />
            <div className={css.formActions}>
              <Button type="submit" variant="primary" size="sm" disabled={saving}>{saving ? t('refreshing') : t('saveHost')}</Button>
              <Button size="sm" variant="ghost" onClick={() => { setFormOpen(false) }}>{t('cancel')}</Button>
            </div>
          </form>
        )}
      </article>
      <article className={css.card}>
        <div className={css.cardHeader}>
          <h3 className={css.cardTitle}>{t('console')}</h3>
          {entries.length > 0 && <Button size="sm" variant="ghost" icon={<IconTrashOutline16 />} onClick={clearOutput}>{t('clearOutput')}</Button>}
        </div>
        <p className={css.hint}>{t('consoleHint')}</p>
        {selected === undefined
          ? <div className={css.empty}>{t('selectHostHint')}</div>
          : (
            <>
              <form className={css.consoleForm} onSubmit={(event) => { event.preventDefault(); run() }}>
                <Input
                  icon={<IconPlayOutline16 />}
                  placeholder={t('commandPlaceholder')}
                  aria-label={t('runAria')}
                  value={command}
                  disabled={running}
                  onChange={(event) => { setCommand(event.target.value) }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp') { event.preventDefault(); recall(-1) }
                    if (event.key === 'ArrowDown') { event.preventDefault(); recall(1) }
                  }}
                />
                <Button type="submit" variant="primary" size="sm" icon={running ? <IconLoadingOutline16 className={css.spin} /> : undefined} disabled={command.trim() === '' || running}>
                  {running ? t('running') : t('run')}
                </Button>
              </form>
              {entries.length === 0
                ? <div className={css.empty}>{t('consoleEmpty')}</div>
                : (
                  <ol className={css.console}>
                    {entries.map((entry, index) => (
                      <li key={index} className={css.consoleEntry}>
                        {!entry.running && entry.result === 'result-unknown' && (
                          <div className={css.warn} role="status">{t('resultUnknown')}</div>
                        )}
                        <TerminalBlock
                          command={entry.command}
                          output={`${entry.stdout}${entry.stderr}`}
                          running={entry.running}
                          exitCode={entry.result === 'known' && entry.exitCode !== null ? entry.exitCode : undefined}
                          labels={labels}
                        />
                      </li>
                    ))}
                  </ol>
                )}
            </>
          )}
      </article>
    </section>
  )
}
