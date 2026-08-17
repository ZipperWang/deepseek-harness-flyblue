import { describe, expect, it } from 'vitest'
import { presentCodegraphCall } from '@deepseek-ai/dsh-tool-codegraph'

describe('presentCodegraphCall', () => {
  it('titles from the first specific argument and attaches a project location', () => {
    expect(presentCodegraphCall({
      query: 'AuthService login',
      projectPath: '/repo',
    }, 'codegraph_explore')).toEqual({
      card: 'generic',
      title: 'AuthService login',
      kind: 'search',
      rawInput: 'AuthService login',
      locations: [{ path: '/repo' }],
    })
  })

  it('falls back through symbol/file/path/pattern then the tool name', () => {
    expect(presentCodegraphCall({ symbol: 'open' }, 'codegraph_node').title).toBe('open')
    expect(presentCodegraphCall({ file: 'src/a.ts' }, 'codegraph_node').title).toBe('src/a.ts')
    expect(presentCodegraphCall({ path: 'src' }, 'codegraph_files').title).toBe('src')
    expect(presentCodegraphCall({ pattern: '*.ts' }, 'codegraph_files').title).toBe('*.ts')
    expect(presentCodegraphCall({}, 'codegraph_status')).toEqual({
      card: 'generic',
      title: 'codegraph_status',
      kind: 'search',
      rawInput: 'codegraph_status',
    })
  })

  it('ignores an empty projectPath', () => {
    expect(presentCodegraphCall({ query: 'x', projectPath: '' }, 'codegraph_explore').locations).toBeUndefined()
  })
})
