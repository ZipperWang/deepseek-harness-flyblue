import type { Context } from '@deepseek-ai/cordis'
import type {
  ConversationMatch, ConversationNodeContext, ConversationNodeDefinition,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-compaction/types'
import type { CompactionChatData } from '../contract/chat-nodes.ts'
import { chatNode } from './common.ts'
import { compactSource, compactSummary, compactionEvidence, updateCompactionState } from './command.ts'

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap {
    /** Automatic or standalone compactNow checkpoint, including the standalone running row. */
    compaction: CompactionChatData
  }
}

interface CompactionState {
  readonly start?: ConversationMatch
  readonly summary?: ConversationMatch
  readonly checkpoint?: ConversationMatch
  readonly end?: ConversationMatch
}

function fallbackState(context: ConversationNodeContext<CompactionState>): CompactionState {
  return compactionEvidence(context.matches)
}

function standaloneRunning(state: CompactionState): ConversationMatch | undefined {
  const start = state.start
  if (start === undefined || start.event.type !== 'compaction/start') return undefined
  if (start.event.data.turn !== null || state.end !== undefined) return undefined
  return start
}

/** Standalone compactNow running row and landed checkpoint Definition. */
export const compactionDefinition: ConversationNodeDefinition<CompactionState> = {
  kind: 'compaction',
  target: 'chat',
  match: (event) => {
    const checkpoint = compactSource(event)
    if (checkpoint !== undefined && checkpoint.sourceCommandId === undefined) {
      return { id: checkpoint.compactionId, role: 'update' }
    }
    if (event.type === 'compaction/start'
      || event.type === 'compaction/summary'
      || event.type === 'compaction/end') {
      if (event.data.sourceCommandId !== undefined) return null
      const compactionId: unknown = event.data.compactionId
      if (typeof compactionId !== 'string' || compactionId === '') return null
      return { id: compactionId, role: event.type === 'compaction/start' ? 'start' : 'update' }
    }
    return null
  },
  start: (_context, match) => updateCompactionState({}, match),
  update: (context, match) => updateCompactionState(context.state, match),
  buildViewNode: (context) => {
    const state = context.state ?? fallbackState(context)
    if (state.checkpoint !== undefined) {
      const marker = compactSummary(state.summary, state.checkpoint)
      return chatNode(context, 'compaction', marker.seq, marker)
    }
    const start = standaloneRunning(state)
    if (start === undefined) return null
    return chatNode(context, 'compaction', start.event.seq, {
      kind: 'compaction',
      phase: 'running',
      seq: start.event.seq,
      time: start.event.time,
    })
  },
}

/**
 * Register the automatic-compaction business contribution.
 * @param ctx - owning UI Conversation context.
 */
export function registerCompactionConversationNode(ctx: Context): void {
  ctx.conversationEvents.register(compactionDefinition)
}
