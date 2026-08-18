/** Git graph settings-section registration. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { GitGraphSection } from './section.tsx'
import { zh, en } from './locales.ts'
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { gitgraph: keyof typeof import('./locales.ts').zh } }
export const inject = ['slots', 'locale', 'remote', 'remote.workspaceGit', 'workspaces']
/** Register the Web workbench usage entry. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('gitgraph', { zh, en }), 'ui-git-graph: dictionaries')
  const t = ctx.locale.bind('gitgraph')
  type WorkspaceArg = Parameters<typeof ctx.remote.workspaceGit.graph>[0]
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'git-graph', order: 42, label: () => t('nav'), locale: 'gitgraph',
    inject: () => ({
      graph: (workspaceId: string) => ctx.remote.workspaceGit.graph(workspaceId as WorkspaceArg),
      status: (workspaceId: string) => ctx.remote.workspaceGit.status(workspaceId as WorkspaceArg),
      branches: (workspaceId: string) => ctx.remote.workspaceGit.branches(workspaceId as WorkspaceArg),
      createBranch: (workspaceId: string, name: string) =>
        ctx.remote.workspaceGit.createBranch(workspaceId as WorkspaceArg, name),
      switchBranch: (workspaceId: string, name: string) =>
        ctx.remote.workspaceGit.switchBranch(workspaceId as WorkspaceArg, name),
      stage: (workspaceId: string, path: string) => ctx.remote.workspaceGit.stage(workspaceId as WorkspaceArg, path),
      unstage: (workspaceId: string, path: string) => ctx.remote.workspaceGit.unstage(workspaceId as WorkspaceArg, path),
      discard: (workspaceId: string, path: string, confirmed: boolean) =>
        ctx.remote.workspaceGit.discard(workspaceId as WorkspaceArg, path, confirmed),
      workspaceId: () => ctx.workspaces.list.getSnapshot().items[0]?.workspaceId,
    }),
  }, GitGraphSection))
}
