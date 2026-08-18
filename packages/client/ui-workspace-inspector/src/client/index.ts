/** Workspace inspector settings-section registration. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { WorkspaceInspectorSection } from './section.tsx'
import { zh, en } from './locales.ts'
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { workspaceinspector: keyof typeof import('./locales.ts').zh } }
export const inject = ['slots', 'locale', 'remote', 'remote.workspaceFiles', 'workspaces']
/** Register the Web workbench usage entry. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('workspaceinspector', { zh, en }), 'ui-workspace-inspector: dictionaries')
  const t = ctx.locale.bind('workspaceinspector')
  type WorkspaceArg = Parameters<typeof ctx.remote.workspaceFiles.tree>[0]
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'workspace-inspector',
    order: 43,
    label: () => t('nav'),
    locale: 'workspaceinspector',
    inject: () => ({
      tree: (workspaceId: string, path: string) =>
        ctx.remote.workspaceFiles.tree(workspaceId as WorkspaceArg, path),
      preview: (workspaceId: string, path: string) =>
        ctx.remote.workspaceFiles.preview(workspaceId as WorkspaceArg, path),
      search: (workspaceId: string, query: string) =>
        ctx.remote.workspaceFiles.search(workspaceId as WorkspaceArg, query),
      workspaceId: () => ctx.workspaces.list.getSnapshot().items[0]?.workspaceId,
    }),
  }, WorkspaceInspectorSection))
}
