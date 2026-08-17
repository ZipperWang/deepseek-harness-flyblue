import { describe, expect, it } from 'vitest'
import { loadCodegraphBindings, resolveCodegraphCli } from '@deepseek-ai/dsh-tool-codegraph'

describe('bundled @colbymchenry/codegraph contract', () => {
  it('exports isInitialized, CodeGraph.open, and ToolHandler', () => {
    const bindings = loadCodegraphBindings()
    expect(typeof bindings.isInitialized).toBe('function')
    expect(typeof bindings.open).toBe('function')
  })

  it('resolves the published CLI script next to the package manifest', () => {
    const cli = resolveCodegraphCli()
    expect(cli.replaceAll('\\', '/')).toMatch(/@colbymchenry\/codegraph\/npm-shim\.js$/)
  })
})
