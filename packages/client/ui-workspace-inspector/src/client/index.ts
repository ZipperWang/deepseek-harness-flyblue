/** Workspace inspector settings-section registration. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { WorkspaceInspectorSection } from './section.tsx'
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { workspaceinspector: 'nav' | 'title' | 'intro' } }
const zh = { nav: '文件检查器', title: '文件检查器', intro: '文件预览和变更使用工作区 ID 与版本令牌保护本机文件。' } as const
const en: Record<keyof typeof zh, string> = { nav: 'Workspace inspector', title: 'Workspace inspector', intro: 'File previews and changes use workspace IDs and version tokens to protect local files.' }
export const inject = ['slots', 'locale', 'remote', 'remote.workspaceFiles', 'workspaces']
/** Register the Web workbench usage entry. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('workspaceinspector', { zh, en }), 'ui-workspace-inspector: dictionaries')
  const t = ctx.locale.bind('workspaceinspector')
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'workspace-inspector', order: 43, label: () => t('nav'), locale: 'workspaceinspector', inject: () => ({ tree: (workspaceId: string) => ctx.remote.workspaceFiles.tree(workspaceId as Parameters<typeof ctx.remote.workspaceFiles.tree>[0], ''), preview: (workspaceId: string, path: string) => ctx.remote.workspaceFiles.preview(workspaceId as Parameters<typeof ctx.remote.workspaceFiles.preview>[0], path), workspaceId: () => ctx.workspaces.list.getSnapshot().items[0]?.workspaceId }) }, WorkspaceInspectorSection))
}
