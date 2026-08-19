/** Package-owned invariant companion for the usage-statistics panel. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
/**
 * No runtime invariant: the client panel only projects the SSH Remote service and owns no independent runtime state.
 */
const install: InvariantInstaller = () => {}
export const name = 'client-ui-ssh-invariant'
export const inject = ['invariants']
/** Reserve package invariant ownership. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register('@deepseek-ai/dsh-client-ui-ssh', install))
