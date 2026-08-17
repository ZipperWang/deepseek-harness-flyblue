/**
 * Settings「代码索引」page: auto-init switch, current workspace status, init now.
 */

import { useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { CodegraphIndexStatus, CodegraphSettings } from '@deepseek-ai/dsh-codegraph-index/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import css from './CodegraphSection.module.css'

/** How often the settings page re-reads host status while indexing. */
const STATUS_POLL_MS = 1000

/** Injected settings write and Remote verbs. */
export interface CodegraphSectionInjected {
  /**
   * Persist the auto-init preference.
   * @param value - next autoInit value.
   */
  setAutoInit: (value: boolean) => void
  /**
   * Read index status for one live session.
   * @param sessionId - current session.
   */
  status: (sessionId: SessionId) => Promise<RemoteResult<CodegraphIndexStatus>>
  /**
   * Start init for one live session.
   * @param sessionId - current session.
   */
  init: (sessionId: SessionId) => Promise<RemoteResult<CodegraphIndexStatus>>
  hooks: {
    /** Bound `codegraph` settings namespace. */
    codegraphSettings: SettingsScope<CodegraphSettings>
  }
}

/** Full settings section props. */
export type CodegraphSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'codegraph'>
  & InjectFace<CodegraphSectionInjected>

/**
 * Render the Code index settings page.
 * @param props - sessions kit, locale, settings, and Remote verbs.
 * @returns the section.
 */
export function CodegraphSection({
  useSessions, t, setAutoInit, status, init, useCodegraphSettings,
}: CodegraphSectionProps) {
  const list = useSessions(snapshot => snapshot)
  const currentId = list.current
  const cwd = currentId === undefined ? undefined : list.byId[currentId]?.cwd
  const settings = useCodegraphSettings(snapshot => snapshot)
  const autoInit = settings.value?.autoInit === true
  const ready = settings.status === 'ready'
  const [current, setCurrent] = useState<CodegraphIndexStatus | undefined>(undefined)

  useEffect(() => {
    if (currentId === undefined) {
      setCurrent(undefined)
      return
    }
    let cancelled = false
    const applyResult = (result: RemoteResult<CodegraphIndexStatus>): void => {
      if (!cancelled && result.ok) setCurrent(result.value)
    }
    const refresh = (): void => {
      void status(currentId).then(applyResult)
    }
    refresh()
    const timer = setInterval(refresh, STATUS_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [currentId, status])

  const statusLabel = current === undefined
    ? undefined
    : current.indexed
      ? t('status.indexed')
      : current.indexing
        ? t('status.indexing')
        : t('status.missing')

  return (
    <div className={css.section}>
      <h2 className={css.title}>{t('title')}</h2>
      <p className={css.intro}>{t('intro')}</p>
      <div className={css.row}>
        <label className={css.label}>
          <input
            type="checkbox"
            role="switch"
            checked={autoInit}
            disabled={!ready || !settings.writable}
            onChange={(event) => { setAutoInit(event.target.checked) }}
          />
          {t('autoInit.label')}
        </label>
        <p className={css.help}>{t('autoInit.help')}</p>
      </div>
      <div className={css.workspace}>
        <div className={css.label}>{t('workspace.label')}</div>
        {cwd === undefined || cwd === ''
          ? <p className={css.status}>{t('workspace.none')}</p>
          : (
            <>
              <p className={css.path}>{cwd}</p>
              {statusLabel !== undefined && <p className={css.status}>{statusLabel}</p>}
              {current?.error !== undefined && <p className={css.error} role="alert">{current.error}</p>}
              {current !== undefined && !current.indexed && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={current.indexing}
                  onClick={() => {
                    if (currentId === undefined) return
                    void init(currentId).then((result) => {
                      if (result.ok) setCurrent(result.value)
                    })
                  }}
                >
                  {current.error === undefined ? t('action.init') : t('action.retry')}
                </Button>
              )}
            </>
          )}
      </div>
    </div>
  )
}
