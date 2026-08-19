/** Package-owned invariant companion for optional SSH tools. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
/**
 * No runtime invariant: tool registration follows the optional SSH service lifecycle and the tool registry owns consistency.
 */
const install: InvariantInstaller = () => {}
export const name = 'tool-ssh-invariant'
export const inject = ['invariants']
/** Reserve package invariant ownership. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register('@deepseek-ai/dsh-tool-ssh', install))
