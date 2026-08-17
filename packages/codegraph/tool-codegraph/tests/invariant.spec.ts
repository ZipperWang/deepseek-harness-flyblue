import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as CodegraphInvariant from '@deepseek-ai/dsh-tool-codegraph/invariant'

describe('tool-codegraph invariant companion', () => {
  it('registers an empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(CodegraphInvariant).then(() => undefined)).resolves.toBeUndefined()
  })
})
