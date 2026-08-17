/**
 * Visibility of the blank-session index prompt.
 * @module @deepseek-ai/dsh-client-ui-codegraph/banner-mode
 */

import type { CodegraphIndexStatus } from '@deepseek-ai/dsh-codegraph-index/client'

/** What the dock banner should render. */
export type CodegraphBannerMode = 'hidden' | 'choice' | 'progress' | 'error'

/** Inputs that decide the dock banner. */
export interface CodegraphBannerInput {
  readonly blank: boolean
  readonly cwd: string | undefined
  readonly dismissed: boolean
  readonly autoInit: boolean
  readonly status: CodegraphIndexStatus | undefined
}

/**
 * Decide the dock banner for one session snapshot.
 * @param input - blankness, cwd, dismiss, auto-init, and latest status.
 * @returns the banner mode.
 */
export function codegraphBannerMode(input: CodegraphBannerInput): CodegraphBannerMode {
  if (!input.blank || input.cwd === undefined || input.cwd === '') return 'hidden'
  if (input.dismissed) return 'hidden'
  if (input.status === undefined) return 'hidden'
  if (input.status.indexed) return 'hidden'
  if (input.status.indexing || input.autoInit) return 'progress'
  if (input.status.error !== undefined) return 'error'
  return 'choice'
}
