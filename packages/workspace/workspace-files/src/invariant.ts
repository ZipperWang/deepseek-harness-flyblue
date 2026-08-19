/** Package-owned invariant companion for workspace file operations. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
/**
 * No runtime invariant: the service is stateless across calls and revalidates path confinement for every filesystem operation.
 */
const install: InvariantInstaller = () => {}
export const name = 'workspace-files-invariant'
export const inject = ['invariants']
/** Reserve this package's invariant ownership. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register('@deepseek-ai/dsh-workspace-files', install))
