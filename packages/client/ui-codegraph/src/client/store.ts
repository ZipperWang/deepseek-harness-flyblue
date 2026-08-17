/**
 * Session-scoped dock store: whether this blank session dismissed the prompt.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Dock store state. */
export interface CodegraphDockState {
  /** True after the user clicks 忽略 on this session. */
  dismissed: boolean
}

/** Declared action shape. */
type CodegraphDockActions = {
  dismiss: (draft: CodegraphDockState) => void
}

/**
 * Declares the per-session dismiss flag.
 * @returns the store handle.
 */
export function createCodegraphDockStore(): EngineStoreHandle<CodegraphDockState, CodegraphDockActions> {
  return defineStore({
    init: (): CodegraphDockState => ({ dismissed: false }),
    actions: {
      dismiss: (draft) => {
        draft.dismissed = true
      },
    },
  })
}
