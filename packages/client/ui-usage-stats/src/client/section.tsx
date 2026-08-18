import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PropsLocale, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import css from './section.module.css'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Local usage dashboard and settings navigation copy. */
    usageStats: keyof typeof import('./locales.ts').zh
  }
}

/** A supported inclusive history range. */
export type UsageDays = 7 | 30
/** Token buckets displayed by this browser surface. */
export interface TokenBuckets {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  reasoningTokens: number
}
/** One dense daily row returned by the Host. */
export interface UsageDay extends TokenBuckets {
  date: string
  totalTokens: number
  sessionCount: number
  messageCount: number
}
/** One provider/model aggregate returned by the Host. */
export interface ModelUsage extends TokenBuckets {
  provider: string
  model: string
  totalTokens: number
  sessionCount: number
}
/** Browser copy of the historical Host snapshot. */
export interface Stats extends TokenBuckets {
  days: UsageDays
  timeZone: string
  startDate: string
  endDate: string
  generatedAt: number
  totalTokens: number
  sessionCount: number
  messageCount: number
  activeDays: number
  currentStreakDays: number
  daily: UsageDay[]
  models: ModelUsage[]
}
/** Remote dependency used by the usage panel. */
export interface UsageStatsInjected { stats: (request: { days: UsageDays }) => Promise<RemoteResult<Stats>> }

interface ModelSegment { provider: string; model: string; totalTokens: number }
const SERIES_CLASSES = [css.series0, css.series1, css.series2, css.series3, css.series4]

/** Collapse model usage to four leading entries plus an optional remainder. */
export function modelSegments(models: readonly ModelUsage[]): ModelSegment[] {
  const head = models.slice(0, 4).map(({ provider, model, totalTokens }) => ({ provider, model, totalTokens }))
  const rest = models.slice(4).reduce((total, model) => total + model.totalTokens, 0)
  return rest === 0 ? head : [...head, { provider: '', model: 'other', totalTokens: rest }]
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
const exactNumber = (value: number): string => new Intl.NumberFormat().format(value)
const dateLabel = (date: string, long = false): string => new Intl.DateTimeFormat(undefined, long
  ? { year: 'numeric', month: 'short', day: 'numeric' }
  : { month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00`))

function Value({ value }: { value: number }) {
  return <span aria-label={exactNumber(value)}>{compactNumber(value)}</span>
}

function Skeleton({ label }: { label: string }) {
  return <div className={css.skeleton} aria-busy="true" aria-label={label}><div className={css.skeletonHeader} /> <div className={css.skeletonGrid}>{Array.from({ length: 6 }, (_, index) => <div className={css.skeletonCard} key={index} />)}</div><div className={css.skeletonChart} /><div className={css.skeletonChart} /></div>
}

/** Render the local usage-history dashboard. */
export function UsageStatsSection({ t, stats }: PropsLocale<'usageStats'> & InjectFace<UsageStatsInjected>) {
  const [snapshot, setSnapshot] = useState<Stats>()
  const [requestedDays, setRequestedDays] = useState<UsageDays>(30)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const requestSequence = useRef(0)
  const committedDays = useRef<UsageDays>(30)
  const load = useCallback((days: UsageDays) => {
    const sequence = ++requestSequence.current
    setBusy(true)
    setError(undefined)
    void stats({ days }).then((result) => {
      if (sequence !== requestSequence.current) return
      setBusy(false)
      if (result.ok) { committedDays.current = result.value.days; setSnapshot(result.value); setRequestedDays(result.value.days) }
      else { setError(result.error.message); setRequestedDays(committedDays.current) }
    })
  }, [stats])
  useEffect(() => { load(30) }, [load])

  const segments = useMemo(() => modelSegments(snapshot?.models ?? []), [snapshot?.models])
  const maxDaily = Math.max(1, ...snapshot?.daily.map(day => day.totalTokens) ?? [0])
  const topModel = snapshot?.models[0]
  const topShare = snapshot !== undefined && topModel !== undefined && snapshot.totalTokens > 0
    ? topModel.totalTokens / snapshot.totalTokens
    : 0
  if (snapshot === undefined && busy) return <section className={css.section} data-usage-stats><h2 className={css.title}>{t('title')}</h2><p className={css.intro}>{t('intro')}</p><Skeleton label={t('loading')} /></section>

  const retry = () => { load(requestedDays) }
  const selectDays = (days: UsageDays) => { if (days !== requestedDays || error !== undefined) { setRequestedDays(days); load(days) } }
  const summary = snapshot === undefined ? '' : t('chart.summary').replace('{tokens}', exactNumber(snapshot.totalTokens)).replace('{messages}', exactNumber(snapshot.messageCount))
  let offset = 0
  return (
    <section className={css.section} data-usage-stats aria-busy={busy}>
      <header className={css.header}>
        <div><h2 className={css.title}>{t('title')}</h2><p className={css.intro}>{t('intro')}</p></div>
        <button type="button" className={css.refresh} disabled={busy} onClick={() => { load(requestedDays) }}>{busy ? t('refreshing') : t('refresh')}</button>
      </header>
      <div className={css.range} aria-label={t('range.label')}>
        {([7, 30] as const).map(days => <button key={days} type="button" aria-pressed={requestedDays === days} className={requestedDays === days ? css.rangeSelected : undefined} onClick={() => { selectDays(days) }}>{t(days === 7 ? 'range.7' : 'range.30')}</button>)}
      </div>
      {busy && snapshot !== undefined && <p className={css.status} role="status">{t('updating')}</p>}
      {error !== undefined && <div className={css.error} role="alert"><span>{t('error')}: {error}</span><button type="button" onClick={retry}>{t('retry')}</button></div>}
      {snapshot === undefined ? <div className={css.empty}>{t('error.empty')}</div> : <>
        <div className={css.kpis}>
          <article><span>{t('kpi.tokens')}</span><strong><Value value={snapshot.totalTokens} /></strong></article>
          <article><span>{t('kpi.sessions')}</span><strong><Value value={snapshot.sessionCount} /></strong></article>
          <article><span>{t('kpi.messages')}</span><strong><Value value={snapshot.messageCount} /></strong></article>
          <article><span>{t('kpi.activeDays')}</span><strong>{snapshot.activeDays}<small> / {snapshot.days}</small></strong></article>
          <article><span>{t('kpi.streak')}</span><strong>{snapshot.currentStreakDays}<small> {t('days')}</small></strong></article>
          <article><span>{t('kpi.model')}</span><strong className={css.modelValue}>{topModel?.model ?? t('none')}</strong><small>{topModel === undefined ? t('noUsage') : `${new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(topShare)} · ${topModel.provider}`}</small></article>
        </div>
        <article className={css.panel}>
          <h3>{t('activity.title')}</h3><p>{t('activity.help')}</p>
          {snapshot.messageCount === 0 ? <div className={css.empty}>{t('activity.empty')}</div> : <ol className={css.heatmap} aria-label={t('activity.title')}>{snapshot.daily.map(day => <li key={day.date} tabIndex={0} className={day.messageCount === 0 ? css.heat0 : day.messageCount < 3 ? css.heat1 : day.messageCount < 6 ? css.heat2 : css.heat3} aria-label={`${dateLabel(day.date, true)}: ${exactNumber(day.messageCount)} ${t('messages')}`} title={`${dateLabel(day.date)} · ${exactNumber(day.messageCount)}`} />)}</ol>}
        </article>
        <article className={css.panel}>
          <h3>{t('trend.title')}</h3><p className={css.srOnly}>{summary}</p>
          {snapshot.totalTokens === 0 ? <div className={css.empty}>{snapshot.messageCount > 0 ? t('trend.noUsage') : t('trend.empty')}</div> : <ol className={css.bars} aria-label={t('trend.title')}>{snapshot.daily.map(day => <li key={day.date} tabIndex={0} aria-label={`${dateLabel(day.date, true)}: ${exactNumber(day.totalTokens)} Token`}><div className={css.barTrack} style={{ '--bar-size': `${day.totalTokens / maxDaily * 100}%` } as CSSProperties}><div className={css.barValue}>{(['uncachedInputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'] as const).map((key, index) => day[key] > 0 && <i key={key} className={SERIES_CLASSES[index]} style={{ flexGrow: day[key] }} />)}</div></div><span>{dateLabel(day.date)}</span></li>)}</ol>}
        </article>
        <article className={css.panel}>
          <h3>{t('models.title')}</h3>
          {segments.length === 0 ? <div className={css.empty}>{t('models.empty')}</div> : <div className={css.modelChart}><svg className={css.donut} viewBox="0 0 42 42" role="img" aria-label={t('models.summary').replace('{count}', exactNumber(snapshot.models.length))}><circle className={css.donutTrack} cx="21" cy="21" r="15.9" pathLength="100" fill="none" /><g transform="rotate(-90 21 21)">{segments.map((segment, index) => { const share = segment.totalTokens / snapshot.totalTokens * 100; const current = offset; offset += share; return <circle key={`${segment.provider}/${segment.model}`} className={SERIES_CLASSES[index]} cx="21" cy="21" r="15.9" pathLength="100" fill="none" strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={-current} /> })}</g></svg><ol className={css.ranking}>{segments.map((segment, index) => <li key={`${segment.provider}/${segment.model}`}><i className={SERIES_CLASSES[index]} /><span>{segment.model === 'other' ? t('other') : segment.model}<small>{segment.provider}</small></span><strong><Value value={segment.totalTokens} /></strong></li>)}</ol></div>}
        </article>
        <article className={css.panel}>
          <h3>{t('breakdown.title')}</h3><div className={css.breakdown}>{([['uncachedInputTokens', 'bucket.input'], ['outputTokens', 'bucket.output'], ['cacheReadTokens', 'bucket.cacheRead'], ['cacheWriteTokens', 'bucket.cacheWrite']] as const).map(([key, label], index) => <div key={key}><i className={SERIES_CLASSES[index]} /><span>{t(label)}</span><strong><Value value={snapshot[key]} /></strong></div>)}</div><p className={css.note}>{t('reasoning').replace('{value}', exactNumber(snapshot.reasoningTokens))}</p>
        </article>
        <details className={css.details}><summary>{t('details')}</summary><div className={css.tableWrap}><table><caption>{t('models.table')}</caption><thead><tr><th>{t('provider')}</th><th>{t('model')}</th><th>{t('tokens')}</th><th>{t('sessions')}</th></tr></thead><tbody>{snapshot.models.map(model => <tr key={`${model.provider}/${model.model}`}><td>{model.provider}</td><td>{model.model}</td><td>{exactNumber(model.totalTokens)}</td><td>{exactNumber(model.sessionCount)}</td></tr>)}</tbody></table><table><caption>{t('daily.table')}</caption><thead><tr><th>{t('date')}</th><th>{t('tokens')}</th><th>{t('messages')}</th><th>{t('sessions')}</th></tr></thead><tbody>{snapshot.daily.map(day => <tr key={day.date}><td>{dateLabel(day.date, true)}</td><td>{exactNumber(day.totalTokens)}</td><td>{exactNumber(day.messageCount)}</td><td>{exactNumber(day.sessionCount)}</td></tr>)}</tbody></table></div></details>
        <p className={css.footer}>{t('updated')} {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: snapshot.timeZone }).format(snapshot.generatedAt)} · {snapshot.timeZone}</p>
      </>}
    </section>
  )
}
