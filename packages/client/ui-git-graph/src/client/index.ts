/** Git graph settings-section registration. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { GitGraphSection } from './section.tsx'
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { gitgraph: 'nav' | 'title' | 'intro' } }
const zh = { nav: 'Git 图谱', title: 'Git 图谱', intro: 'Git 图谱和分支操作只作用于已登记的本机工作区。' } as const
const en: Record<keyof typeof zh, string> = { nav: 'Git graph', title: 'Git graph', intro: 'Git graph and branch actions are limited to registered local workspaces.' }
export const inject = ['slots', 'locale', 'remote', 'remote.workspaceGit', 'workspaces']
/** Register the Web workbench usage entry. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('gitgraph', { zh, en }), 'ui-git-graph: dictionaries')
  const t = ctx.locale.bind('gitgraph')
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'git-graph', order: 42, label: () => t('nav'), locale: 'gitgraph', inject: () => ({ graph: (workspaceId: string) => ctx.remote.workspaceGit.graph(workspaceId as Parameters<typeof ctx.remote.workspaceGit.graph>[0]), status: (workspaceId: string) => ctx.remote.workspaceGit.status(workspaceId as Parameters<typeof ctx.remote.workspaceGit.status>[0]), workspaceId: () => ctx.workspaces.list.getSnapshot().items[0]?.workspaceId }) }, GitGraphSection))
}
