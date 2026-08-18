/** SSH operations settings-section registration. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { SshSection } from './section.tsx'
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { ssh: 'nav' | 'title' | 'intro' } }
const zh = { nav: 'SSH 运维', title: 'SSH 运维', intro: '主机配置和远程运维仅可从本机浏览器使用。' } as const
const en: Record<keyof typeof zh, string> = { nav: 'SSH operations', title: 'SSH operations', intro: 'Host configuration and remote operations are available only from a local browser.' }
export const inject = ['slots', 'locale', 'remote', 'remote.ssh']
/** Register the Web workbench usage entry. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('ssh', { zh, en }), 'ui-ssh: dictionaries')
  const t = ctx.locale.bind('ssh')
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'ssh', order: 44, label: () => t('nav'), locale: 'ssh', inject: () => ({ list: () => ctx.remote.ssh.list(), exec: (id: string, command: string) => ctx.remote.ssh.exec(id as Parameters<typeof ctx.remote.ssh.exec>[0], command) }) }, SshSection))
}
