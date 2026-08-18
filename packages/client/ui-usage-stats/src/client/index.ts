/** Usage statistics settings-section registration. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { UsageStatsSection } from './section.tsx'
import type { UsageDays } from './section.tsx'
import { en, zh } from './locales.ts'
export const inject = ['slots', 'locale', 'remote', 'remote.usageStats']

/** Register the Web workbench usage entry. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('usageStats', { zh, en }), 'ui-usage-stats: dictionaries')
  const t = ctx.locale.bind('usageStats')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'usage-stats', order: 40, label: () => t('nav'), locale: 'usageStats',
    inject: () => ({ stats: (request: { days: UsageDays }) => ctx.remote.usageStats.stats(request) }),
  }, UsageStatsSection))
}
