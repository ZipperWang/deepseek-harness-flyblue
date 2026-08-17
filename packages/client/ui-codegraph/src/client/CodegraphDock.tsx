/**
 * Blank-session CodeGraph index prompt in conversation.input.dock.
 */

import { useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { CodegraphIndexStatus, CodegraphSettings } from '@deepseek-ai/dsh-codegraph-index/client'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { codegraphBannerMode } from './banner-mode.ts'
import type { createCodegraphDockStore } from './store.ts'
import css from './CodegraphDock.module.css'

/** How often the dock re-reads host status while the prompt is relevant. */
const STATUS_POLL_MS = 1000

/** Injected Remote verbs and the auto-init settings scope. */
export interface CodegraphDockInjected {
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

/** Presentational banner props. */
export interface CodegraphIndexBannerProps {
  readonly mode: ReturnType<typeof codegraphBannerMode>
  readonly error?: string
  readonly onInit: () => void
  readonly onDismiss: () => void
  readonly t: PropsLocale<'codegraph'>['t']
}

/**
 * Render the choice / progress / error strip.
 * @param props - decided mode and actions.
 * @returns the dock strip, or null when hidden.
 */
export function CodegraphIndexBanner({ mode, error, onInit, onDismiss, t }: CodegraphIndexBannerProps) {
  if (mode === 'hidden') return null
  if (mode === 'progress') {
    return (
      <div className={css.dock} data-codegraph-index>
        <div className={css.bar}>
          <span className={css.message}>{t('dock.indexing')}</span>
        </div>
      </div>
    )
  }
  if (mode === 'error') {
    return (
      <div className={css.dock} data-codegraph-index>
        <div className={css.bar}>
          <span className={css.error} role="alert">{error ?? t('dock.failed')}</span>
          <div className={css.actions}>
            <Button variant="primary" size="sm" onClick={onInit}>{t('action.retry')}</Button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className={css.dock} data-codegraph-index>
      <div className={css.bar}>
        <span className={css.message}>{t('dock.prompt')}</span>
        <div className={css.actions}>
          <Button variant="primary" size="sm" onClick={onInit}>{t('dock.init')}</Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>{t('dock.dismiss')}</Button>
        </div>
      </div>
    </div>
  )
}

/** Full dock entry props. */
export type CodegraphDockProps =
  PropsRuntime<'conversation.input.dock'>
  & PropsStore<ReturnType<typeof createCodegraphDockStore>>
  & PropsLocale<'codegraph'>
  & InjectFace<CodegraphDockInjected>

/**
 * Session dock adapter: polls host status and renders the banner.
 * @param props - session kit, store, locale, and Remote verbs.
 * @returns the banner, or null.
 */
export function CodegraphDock({
  session, sessionId, useSessions, useStore, actions, status, init, useCodegraphSettings, t,
}: CodegraphDockProps) {
  const cwd = useSessions(list => list.byId[sessionId]?.cwd)
  const dismissed = useStore(state => state.dismissed)
  const settings = useCodegraphSettings(snapshot => snapshot)
  const autoInit = settings.status === 'ready' && settings.value?.autoInit === true
  const [current, setCurrent] = useState<CodegraphIndexStatus | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    const applyResult = (result: RemoteResult<CodegraphIndexStatus>): void => {
      if (!cancelled && result.ok) setCurrent(result.value)
    }
    const refresh = (): void => {
      void status(sessionId).then(applyResult)
    }
    refresh()
    const timer = setInterval(refresh, STATUS_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [sessionId, status])

  const mode = codegraphBannerMode({
    blank: session.blank,
    cwd,
    dismissed,
    autoInit,
    status: current,
  })

  return (
    <CodegraphIndexBanner
      mode={mode}
      {...current?.error === undefined ? {} : { error: current.error }}
      onInit={() => {
        void init(sessionId).then((result) => {
          if (result.ok) setCurrent(result.value)
        })
      }}
      onDismiss={() => { actions.dismiss() }}
      t={t}
    />
  )
}
