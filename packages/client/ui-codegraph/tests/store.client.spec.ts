import { describe, expect, it } from 'vitest'
import { createCodegraphDockStore } from '../src/client/store.ts'

describe('createCodegraphDockStore', () => {
  it('starts visible and dismisses for this session instance', () => {
    const instance = createCodegraphDockStore().create()
    expect(instance.getSnapshot().dismissed).toBe(false)
    instance.actions.dismiss()
    expect(instance.getSnapshot().dismissed).toBe(true)
  })
})
