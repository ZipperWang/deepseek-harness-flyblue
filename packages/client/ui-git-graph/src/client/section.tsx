/**
 * Git graph settings section: working-tree changes with stage/unstage/discard,
 * branch switching and creation, and a lane-assigned commit graph. All data
 * arrives through the injected Remote verbs scoped to the first registered
 * workspace; the workspace path shown in the header is a presentation-only
 * projection of the shared workspace source.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import {
  Button, IconBranchOutline16, IconCopyOutline16, IconLoadingOutline16, IconPlusOutline16,
  IconRefreshOutline16, Input, Pill, writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import css from './section.module.css'

interface Commit { hash: string; parents: string[]; subject: string; refs: string[] }
interface Status { path: string; index: string; worktree: string }
interface BranchInfo { current: string | null; branches: string[] }

/** Remote dependency surface used by the Git panel. */
export interface GitGraphInjected {
  /** Read the bounded commit graph. */
  graph: (workspaceId: string) => Promise<RemoteResult<Commit[]>>
  /** Read porcelain working-tree status. */
  status: (workspaceId: string) => Promise<RemoteResult<Status[]>>
  /** Read local branches and the current branch. */
  branches: (workspaceId: string) => Promise<RemoteResult<BranchInfo>>
  /** Create a branch at the current HEAD. */
  createBranch: (workspaceId: string, name: string) => Promise<RemoteResult<void>>
  /** Switch to a clean local branch. */
  switchBranch: (workspaceId: string, name: string) => Promise<RemoteResult<void>>
  /** Stage one path. */
  stage: (workspaceId: string, path: string) => Promise<RemoteResult<void>>
  /** Unstage one path. */
  unstage: (workspaceId: string, path: string) => Promise<RemoteResult<void>>
  /** Discard one path after explicit confirmation. */
  discard: (workspaceId: string, path: string, confirmed: boolean) => Promise<RemoteResult<void>>
  /** The first registered workspace id, if any. */
  workspaceId: () => string | undefined
}

/** How one porcelain status pair is presented. */
export type ChangeKind = 'staged' | 'unstaged' | 'untracked' | 'conflict'

/** Classification of one porcelain status pair plus its action flags. */
export interface ChangeMeta {
  kind: ChangeKind
  /** Whether the change is staged in the index. */
  staged: boolean
  /** Whether the working tree (or an untracked file) holds a change. */
  worktree: boolean
}

/** Porcelain v1 two-character conflict codes (index+worktree). */
const CONFLICT_CODES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

/**
 * Classify one porcelain v1 status pair.
 * @param index - Index column code.
 * @param worktree - Worktree column code.
 * @returns the kind and the stage/discard action flags.
 */
export function statusMeta(index: string, worktree: string): ChangeMeta {
  const code = `${index}${worktree}`
  if (CONFLICT_CODES.has(code)) return { kind: 'conflict', staged: false, worktree: false }
  if (code === '??') return { kind: 'untracked', staged: false, worktree: true }
  const staged = index !== ' '
  const worktreeChanged = worktree !== ' '
  if (!staged && !worktreeChanged) return { kind: 'unstaged', staged: false, worktree: false }
  return { kind: staged ? 'staged' : 'unstaged', staged, worktree: worktreeChanged }
}

/** One commit's lane position and the lanes whose trunks pass through its row. */
export interface CommitLane {
  /** Column index of the commit dot. */
  lane: number
  /** Columns that keep a trunk below this row. */
  lines: readonly number[]
}

/**
 * Assign graph lanes top-down. Each lane's tip is the newest commit not yet
 * consumed; a commit continues the lane whose tip it is (or opens a new lane),
 * its first parent keeps that lane's column, and extra merge parents open
 * new lanes unless already present.
 * @param commits - Commit rows, newest first.
 * @returns per-commit lane positions and continuing trunk columns.
 */
export function assignLanes(commits: readonly Commit[]): CommitLane[] {
  const tips: (string | undefined)[] = []
  const rows: CommitLane[] = []
  for (const commit of commits) {
    let lane = tips.indexOf(commit.hash)
    if (lane === -1) {
      const hole = tips.indexOf(undefined)
      lane = hole === -1 ? tips.length : hole
      tips[lane] = commit.hash
    }
    const after = [...tips]
    const firstParent = commit.parents[0]
    after[lane] = firstParent
    for (const parent of commit.parents.slice(1)) {
      if (after.includes(parent)) continue
      const hole = after.indexOf(undefined)
      if (hole === -1) after.push(parent)
      else after[hole] = parent
    }
    rows.push({ lane, lines: after.flatMap((tip, index) => tip === undefined ? [] : [index]) })
    for (let index = 0; index < after.length; index++) tips[index] = after[index]
    while (tips.length > 0 && tips[tips.length - 1] === undefined) tips.pop()
  }
  return rows
}

/** Lane dot palette size; colors resolve from the section's custom properties. */
const LANE_COLORS = 5

/** How long the copy-success label stays visible, in ms. */
const COPIED_MS = 1000

/** Status kind to a CSS class. */
function kindClass(kind: ChangeKind): string | undefined {
  if (kind === 'conflict') return css.kindConflict
  if (kind === 'untracked') return css.kindUntracked
  if (kind === 'staged') return css.kindStaged
  return css.kindUnstaged
}

/**
 * Render the Git graph settings section.
 * @param props - locale, Remote verbs, and the shared workspace source.
 * @returns the section element tree.
 */
export function GitGraphSection({
  t, graph, status, branches, createBranch, switchBranch, stage, unstage, discard, workspaceId, useWorkspaces,
}: PropsLocale<'gitgraph'> & InjectFace<GitGraphInjected> & PropsRuntime<'settings.section'>) {
  const workspacePath = useWorkspaces(snapshot => snapshot.items[0]?.path)
  const [commits, setCommits] = useState<Commit[]>([])
  const [changes, setChanges] = useState<Status[]>([])
  const [branchInfo, setBranchInfo] = useState<BranchInfo | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [pendingPaths, setPendingPaths] = useState<ReadonlySet<string>>(() => new Set())
  const [confirmDiscard, setConfirmDiscard] = useState<string | undefined>(undefined)
  const [newBranch, setNewBranch] = useState('')
  const [creatingBranch, setCreatingBranch] = useState(false)
  const [switchingBranch, setSwitchingBranch] = useState<string | undefined>(undefined)
  const [copiedHash, setCopiedHash] = useState<string | undefined>(undefined)
  const sequence = useRef(0)
  const id = workspaceId()

  const refresh = useCallback(() => {
    const current = workspaceId()
    if (current === undefined) return
    const seq = ++sequence.current
    setBusy(true)
    setError(undefined)
    // Each facet lands as it arrives; busy clears once the last in-flight
    // facet of the current sequence settles.
    const settle = (): void => { setBusy(false) }
    void graph(current).then((result) => {
      if (seq !== sequence.current) return
      if (result.ok) setCommits(result.value)
      else setError(result.error.message)
      settle()
    })
    void status(current).then((result) => {
      if (seq !== sequence.current) return
      if (result.ok) setChanges(result.value)
      else setError(result.error.message)
      settle()
    })
    void branches(current).then((result) => {
      if (seq !== sequence.current) return
      if (result.ok) setBranchInfo(result.value)
      else setError(result.error.message)
      settle()
    })
  }, [graph, status, branches, workspaceId])

  useEffect(() => { refresh() }, [refresh])

  /** Run one path mutation, then refresh the whole panel on success. */
  const mutatePath = useCallback((path: string, action: () => Promise<RemoteResult<void>>) => {
    setPendingPaths(previous => new Set(previous).add(path))
    void action().then((result) => {
      setPendingPaths((previous) => {
        const next = new Set(previous)
        next.delete(path)
        return next
      })
      if (result.ok) { setConfirmDiscard(undefined); refresh() }
      else setError(result.error.message)
    })
  }, [refresh])

  const switchTo = (name: string, target: string): void => {
    setSwitchingBranch(name)
    void switchBranch(target, name).then((result) => {
      setSwitchingBranch(undefined)
      if (result.ok) refresh()
      else setError(result.error.message)
    })
  }

  const submitBranch = (event: FormEvent, target: string): void => {
    event.preventDefault()
    const name = newBranch.trim()
    if (name === '' || creatingBranch) return
    setCreatingBranch(true)
    void createBranch(target, name).then((result) => {
      setCreatingBranch(false)
      if (result.ok) { setNewBranch(''); refresh() }
      else setError(result.error.message)
    })
  }

  const copyHash = (hash: string): void => {
    void writeClipboard(hash).then((ok) => {
      if (!ok) return
      setCopiedHash(hash)
      window.setTimeout(() => { setCopiedHash(undefined) }, COPIED_MS)
    })
  }

  const lanes = useMemo(() => assignLanes(commits), [commits])
  const maxLanes = lanes.length === 0 ? 0 : Math.max(...lanes.map(row => Math.max(row.lane + 1, row.lines.length)))
  const firstLoad = busy && commits.length === 0 && changes.length === 0 && branchInfo === undefined

  return (
    <section className={css.section} data-git-graph aria-busy={busy}>
      <header className={css.header}>
        <div>
          <h2 className={css.title}>{t('title')}</h2>
          <p className={css.intro}>{t('intro')}</p>
        </div>
        <div className={css.headerMeta}>
          {workspacePath !== undefined && <Pill className={css.workspacePill} title={workspacePath}>{t('workspace')} · {workspacePath}</Pill>}
          <Button
            variant="ghost"
            size="sm"
            icon={busy ? <IconLoadingOutline16 className={css.spin} /> : <IconRefreshOutline16 />}
            disabled={busy || id === undefined}
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
      {id === undefined
        ? <div className={css.empty}>{t('noWorkspace')}</div>
        : firstLoad
          ? <div className={css.skeleton} aria-busy="true" aria-label={t('loading')}><div className={css.skeletonCard} /><div className={css.skeletonCard} /><div className={css.skeletonCard} /></div>
          : (
            <>
              <article className={css.card}>
                <h3 className={css.cardTitle}>{t('changes')}</h3>
                {changes.length === 0
                  ? <p className={css.empty}>{t('changesEmpty')}</p>
                  : (
                    <ul className={css.list}>
                      {changes.map((change, index) => {
                        const meta = statusMeta(change.index, change.worktree)
                        const pending = pendingPaths.has(change.path)
                        return (
                          <li key={change.path} className={css.row} style={{ '--row-index': index } as CSSProperties}>
                            <span className={kindClass(meta.kind)}>{t(meta.kind)}</span>
                            <code className={css.path} title={change.path}>{change.path}</code>
                            <span className={css.actions}>
                              {meta.staged && (
                                <Button size="sm" variant="ghost" disabled={pending} onClick={() => { mutatePath(change.path, () => unstage(id, change.path)) }}>
                                  {t('unstage')}
                                </Button>
                              )}
                              {meta.worktree && (
                                <Button size="sm" variant="ghost" disabled={pending} onClick={() => { mutatePath(change.path, () => stage(id, change.path)) }}>
                                  {t('stage')}
                                </Button>
                              )}
                              {meta.worktree && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className={css.danger}
                                  disabled={pending}
                                  onClick={() => {
                                    if (confirmDiscard === change.path) mutatePath(change.path, () => discard(id, change.path, true))
                                    else setConfirmDiscard(change.path)
                                  }}
                                >
                                  {confirmDiscard === change.path ? t('discardConfirm') : t('discard')}
                                </Button>
                              )}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
              </article>
              <article className={css.card}>
                <h3 className={css.cardTitle}>{t('branches')}</h3>
                {branchInfo === undefined ? null : branchInfo.branches.length === 0
                  ? <p className={css.empty}>{t('branchesEmpty')}</p>
                  : (
                    <ul className={css.list}>
                      {branchInfo.branches.map((name, index) => {
                        const current = name === branchInfo.current
                        const switching = switchingBranch === name
                        return (
                          <li key={name} className={css.row} style={{ '--row-index': index } as CSSProperties}>
                            <IconBranchOutline16 className={current ? css.branchIconCurrent : css.branchIcon} />
                            <span className={current ? css.branchCurrent : css.branchName}>{name}</span>
                            {current ? <Pill active>{t('currentBranch')}</Pill> : (
                              <span className={css.actions}>
                                <Button size="sm" variant="ghost" disabled={switching} onClick={() => { switchTo(name, id) }}>
                                  {t('switch')}
                                </Button>
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                <form className={css.branchForm} onSubmit={(event) => { submitBranch(event, id) }}>
                  <Input
                    icon={<IconPlusOutline16 />}
                    placeholder={t('branchPlaceholder')}
                    aria-label={t('newBranch')}
                    value={newBranch}
                    onChange={(event) => { setNewBranch(event.target.value) }}
                  />
                  <Button type="submit" variant="primary" size="sm" disabled={newBranch.trim() === '' || creatingBranch}>
                    {t('create')}
                  </Button>
                </form>
              </article>
              <article className={css.card}>
                <h3 className={css.cardTitle}>{t('history')}</h3>
                {commits.length === 0
                  ? <p className={css.empty}>{t('historyEmpty')}</p>
                  : (
                    <ol className={css.commits}>
                      {commits.map((commit, index) => {
                        /* v8 ignore next -- assignLanes returns one row per commit */
                        const lane = lanes[index] ?? { lane: 0, lines: [] }
                        return (
                          <li key={commit.hash} className={css.commitRow} style={{ '--row-index': index } as CSSProperties}>
                            <span className={css.lanes} style={{ width: maxLanes * 14 }}>
                              {Array.from({ length: maxLanes }, (_, column) => (
                                <span key={column} className={css.laneCol}>
                                  {lane.lines.includes(column) && <span className={css.laneLine} />}
                                  {column === lane.lane && (
                                    <span className={css.laneDot} style={{ '--lane-color': `var(--lane-${lane.lane % LANE_COLORS})` } as CSSProperties} />
                                  )}
                                </span>
                              ))}
                            </span>
                            <code className={css.hash} title={commit.hash}>{commit.hash.slice(0, 12)}</code>
                            <span className={css.subject} title={commit.subject}>{commit.subject}</span>
                            <span className={css.refs}>
                              {commit.refs.map(ref => <Pill key={ref} active={ref.startsWith('HEAD')}>{ref}</Pill>)}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={css.copy}
                              aria-label={t('copyHash')}
                              onClick={() => { copyHash(commit.hash) }}
                            >
                              {copiedHash === commit.hash ? t('copied') : <IconCopyOutline16 />}
                            </Button>
                          </li>
                        )
                      })}
                    </ol>
                  )}
              </article>
            </>
          )}
    </section>
  )
}
