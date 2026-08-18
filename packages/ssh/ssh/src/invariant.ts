/** Package-owned invariant companion for SSH host operations. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
const install: InvariantInstaller = () => {}
export const name = 'ssh-invariant'
export const inject = ['invariants']
/** Reserve package invariant ownership. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register('@deepseek-ai/dsh-ssh', install))
