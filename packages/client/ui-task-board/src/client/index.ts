/** Task board settings-section registration. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { TaskBoardSection } from './section.tsx'
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { taskboard: 'nav' | 'title' | 'intro' } }
const zh = { nav: '任务看板', title: '任务看板', intro: '任务看板在宿主上调度并记录任务执行。' } as const
const en: Record<keyof typeof zh, string> = { nav: 'Task board', title: 'Task board', intro: 'The task board schedules and records host task execution.' }
export const inject = ['slots', 'locale', 'remote', 'remote.taskBoard']
/** Register the Web workbench usage entry. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('taskboard', { zh, en }), 'ui-task-board: dictionaries')
  const t = ctx.locale.bind('taskboard')
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'task-board', order: 41, label: () => t('nav'), locale: 'taskboard', inject: () => ({ list: () => ctx.remote.taskBoard.list(), create: (title: string, requestId: string) => ctx.remote.taskBoard.create(title, requestId), archive: (id: string, requestId: string) => ctx.remote.taskBoard.archive(id as Parameters<typeof ctx.remote.taskBoard.archive>[0], requestId) }) }, TaskBoardSection))
}
