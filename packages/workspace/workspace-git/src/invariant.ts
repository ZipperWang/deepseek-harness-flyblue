/** Package-owned invariant companion for shared workspace Git state. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
const install: InvariantInstaller = () => {}
export const name = 'workspace-git-invariant'
export const inject = ['invariants']
/** Reserve this package's invariant ownership. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register('@deepseek-ai/dsh-workspace-git', install))
