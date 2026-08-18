/** Task board settings-section registration. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { TaskBoardSection } from './section.tsx'
import { zh, en } from './locales.ts'
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { taskboard: keyof typeof import('./locales.ts').zh } }
export const inject = ['slots', 'locale', 'remote', 'remote.taskBoard']
/** Register the Web workbench usage entry. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('taskboard', { zh, en }), 'ui-task-board: dictionaries')
  const t = ctx.locale.bind('taskboard')
  type TaskArg = Parameters<typeof ctx.remote.taskBoard.archive>[0]
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'task-board', order: 41, label: () => t('nav'), locale: 'taskboard',
    inject: () => ({
      list: () => ctx.remote.taskBoard.list(),
      create: (title: string, requestId: string) => ctx.remote.taskBoard.create(title, requestId),
      archive: (id: string, requestId: string) => ctx.remote.taskBoard.archive(id as TaskArg, requestId),
      update: (id: string, title: string, requestId: string) =>
        ctx.remote.taskBoard.update(id as TaskArg, title, requestId),
      remove: (id: string, requestId: string) => ctx.remote.taskBoard.remove(id as TaskArg, requestId),
    }),
  }, TaskBoardSection))
}
