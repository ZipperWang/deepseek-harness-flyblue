/**
 * Workspace inspector settings section: a bounded local file browser with
 * directory navigation, filename search, and a text preview pane. The section
 * is read-only; mutations stay on the Host service.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Button, IconChevronRightOutline14, IconFolderOpenOutline16, IconLoadingOutline16,
  IconRefreshOutline16, IconSearchOutline16, Input, Pill,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import css from './section.module.css'

interface Entry { path: string; name: string; directory: boolean; size: number }
interface Preview { path: string; content: string; truncated: boolean; version?: string }

/** Remote dependency surface used by the inspector. */
export interface WorkspaceInspectorInjected {
  /** List immediate children of one workspace-relative directory. */
  tree: (workspaceId: string, path: string) => Promise<RemoteResult<Entry[]>>
  /** Read a bounded UTF-8 preview. */
  preview: (workspaceId: string, path: string) => Promise<RemoteResult<Preview>>
  /** Search filenames by a case-insensitive fragment. */
  search: (workspaceId: string, query: string) => Promise<RemoteResult<Entry[]>>
  /** The first registered workspace id, if any. */
  workspaceId: () => string | undefined
}

/** How long the search input waits after the last keystroke, in ms. */
export const SEARCH_DEBOUNCE_MS = 250

/**
 * Format a file size as a compact B/KB/MB label.
 * @param size - Size in bytes.
 * @returns the formatted label.
 */
export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Split a workspace-relative path into breadcrumb segments.
 * @param path - Workspace-relative path, or an empty string for the root.
 * @returns the segments in order.
 */
export function breadcrumbSegments(path: string): string[] {
  return path === '' ? [] : path.split('/').filter(Boolean)
}

/**
 * Render the workspace inspector settings section.
 * @param props - locale, Remote verbs, and the shared workspace source.
 * @returns the section element tree.
 */
export function WorkspaceInspectorSection({
  t, tree, preview, search, workspaceId, useWorkspaces,
}: PropsLocale<'workspaceinspector'> & InjectFace<WorkspaceInspectorInjected> & PropsRuntime<'settings.section'>) {
  const workspacePath = useWorkspaces(snapshot => snapshot.items[0]?.path)
  const [cwd, setCwd] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [selected, setSelected] = useState<Preview | undefined>(undefined)
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Entry[]>([])
  const [searching, setSearching] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const sequence = useRef(0)
  const id = workspaceId()
  const searchingMode = query.trim() !== ''
  const firstLoad = busy && entries.length === 0 && cwd === '' && !searchingMode

  const loadTree = useCallback((target: string) => {
    const current = workspaceId()
    if (current === undefined) return
    const seq = ++sequence.current
    setBusy(true)
    setError(undefined)
    void tree(current, target).then((result) => {
      if (seq !== sequence.current) return
      setBusy(false)
      if (result.ok) setEntries(result.value)
      else setError(result.error.message)
    })
  }, [tree, workspaceId])

  useEffect(() => { loadTree(cwd) }, [loadTree, cwd])

  useEffect(() => {
    const value = query.trim()
    const current = workspaceId()
    if (value === '' || current === undefined) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      const seq = ++sequence.current
      setSearching(true)
      setError(undefined)
      void search(current, value).then((result) => {
        setSearching(false)
        if (cancelled || seq !== sequence.current) return
        if (result.ok) setResults(result.value)
        else setError(result.error.message)
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [query, search, workspaceId])

  const navigate = (target: string): void => {
    setCwd(target)
    setQuery('')
    setSelected(undefined)
    setSelectedPath(undefined)
  }

  const openPreview = (entry: Entry): void => {
    const current = workspaceId()
    /* v8 ignore next -- file rows render only while a workspace id is present */
    if (current === undefined) return
    const seq = ++sequence.current
    setSelectedPath(entry.path)
    setPreviewLoading(true)
    void preview(current, entry.path).then((result) => {
      setPreviewLoading(false)
      if (seq !== sequence.current) return
      if (result.ok) setSelected(result.value)
      else setError(result.error.message)
    })
  }

  const refresh = (): void => { loadTree(cwd) }

  const listed = searchingMode ? results : entries
  const emptyKey = searchingMode ? 'searchEmpty' : 'treeEmpty'
  const segments = breadcrumbSegments(cwd)

  return (
    <section className={css.section} data-workspace-inspector aria-busy={busy}>
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
          ? <div className={css.skeleton} aria-busy="true" aria-label={t('loading')}><div className={css.skeletonPane} /><div className={css.skeletonPane} /></div>
          : (
            <>
              <Input
                icon={<IconSearchOutline16 />}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchAria')}
                value={query}
                onChange={(event) => { setQuery(event.target.value) }}
              />
              <div className={css.panes}>
                <div className={css.pane}>
                  <nav className={css.breadcrumb} aria-label={t('root')}>
                    <button type="button" className={css.crumb} onClick={() => { navigate('') }}>{t('root')}</button>
                    {segments.map((segment, index) => {
                      const target = segments.slice(0, index + 1).join('/')
                      return (
                        <span key={target} className={css.crumbGroup}>
                          <IconChevronRightOutline14 className={css.crumbSep} />
                          <button type="button" className={css.crumb} onClick={() => { navigate(target) }}>{segment}</button>
                        </span>
                      )
                    })}
                  </nav>
                  {searching
                    ? <div className={css.empty} role="status">{t('loading')}</div>
                    : listed.length === 0
                      ? <div className={css.empty}>{t(emptyKey)}</div>
                      : (
                        <ul className={css.list}>
                          {listed.map((entry, index) => {
                            const active = selectedPath === entry.path
                            return (
                              <li key={entry.path} className={css.row} style={{ '--row-index': index } as CSSProperties}>
                                <button
                                  type="button"
                                  className={active ? css.entryActive : css.entry}
                                  onClick={() => {
                                    if (entry.directory) navigate(entry.path)
                                    else openPreview(entry)
                                  }}
                                >
                                  {entry.directory
                                    ? <IconFolderOpenOutline16 className={css.entryIcon} />
                                    : <span className={css.fileIcon} aria-hidden="true" />}
                                  <span className={css.entryName} title={entry.path}>{entry.name}</span>
                                  <span className={css.entryMeta}>{entry.directory ? t('directory') : formatBytes(entry.size)}</span>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                </div>
                <article className={css.pane}>
                  <h3 className={css.cardTitle}>{t('previewTitle')}</h3>
                  {previewLoading
                    ? <div className={css.empty} role="status">{t('previewLoading')}</div>
                    : selected === undefined
                      ? <div className={css.empty}>{t('previewHint')}</div>
                      : (
                        <>
                          <div className={css.previewMeta}>
                            <code className={css.previewPath} title={selected.path}>{selected.path}</code>
                            <span className={css.previewStat}>{t('size')} · {formatBytes(selected.content.length)}</span>
                            {selected.version !== undefined && <span className={css.previewStat}>{t('version')} · {selected.version}</span>}
                            {selected.truncated && <Pill>{t('truncated')}</Pill>}
                          </div>
                          <pre className={css.preview}>{selected.content}</pre>
                        </>
                      )}
                </article>
              </div>
            </>
          )}
    </section>
  )
}
