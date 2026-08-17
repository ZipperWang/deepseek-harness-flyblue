import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as UiCodegraphInvariant from '../src/invariant.ts'
import { apply as nodeApply } from '../src/index.ts'

describe('ui-codegraph invariant companion', () => {
  it('registers the package-owned empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(UiCodegraphInvariant)
    await expect(fiber.await()).resolves.toBeDefined()
    await fiber.dispose()
    await expect(ctx.plugin(UiCodegraphInvariant).await()).resolves.toBeDefined()
    nodeApply()
    await ctx.fiber.dispose()
  })
})
