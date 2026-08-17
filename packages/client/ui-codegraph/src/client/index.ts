/**
 * CodeGraph index surface, browser half: the「代码索引」settings page and
 * the blank-session dock prompt. Index facts arrive through Remote polling;
 * dismiss is a session-scoped store. Auto-init is the `codegraph` settings
 * namespace owned by the host index manager.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { CodegraphSettings } from '@deepseek-ai/dsh-codegraph-index/client'
// Type-only: generated Remote API and ctx.remote merge.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: conversation.input.dock SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: settings.section SlotMap merge and ctx.settingsScope.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: ctx.locale.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { CodegraphDock } from './CodegraphDock.tsx'
import type { CodegraphDockInjected } from './CodegraphDock.tsx'
import { CodegraphSection } from './CodegraphSection.tsx'
import type { CodegraphSectionInjected } from './CodegraphSection.tsx'
import { createCodegraphDockStore } from './store.ts'
import { en, zh, type CodegraphKey } from './locales.ts'

export type { CodegraphKey } from './locales.ts'
export { createCodegraphDockStore } from './store.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Code index settings and dock copy. */
    codegraph: CodegraphKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'codegraph'

/** Required services for the settings page, dock, Remote, and copy. */
export const inject = [
  'slots', 'locale', 'remote', 'remote.codegraphIndex', 'settingsScope',
]

/**
 * Client plugin body: settings section and dock prompt.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-codegraph: dictionaries')

  const t = ctx.locale.bind(NS)
  const host = ctx.settingsScope.bind<CodegraphSettings>({ namespace: 'codegraph' })
  const dockStore = createCodegraphDockStore()
  const remote: Pick<CodegraphDockInjected, 'status' | 'init'> = {
    status: sessionId => ctx.remote.codegraphIndex.status(sessionId),
    init: sessionId => ctx.remote.codegraphIndex.init(sessionId),
  }

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'codegraph',
    order: 25,
    label: () => t('nav'),
    locale: NS,
    inject: (): CodegraphSectionInjected => ({
      setAutoInit: (value) => { void host.set('autoInit', value) },
      ...remote,
      hooks: { codegraphSettings: host },
    }),
  }, CodegraphSection))

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'codegraph-index',
    order: 5,
    locale: NS,
    store: dockStore,
    inject: (): CodegraphDockInjected => ({
      ...remote,
      hooks: { codegraphSettings: host },
    }),
  }, CodegraphDock))
}
