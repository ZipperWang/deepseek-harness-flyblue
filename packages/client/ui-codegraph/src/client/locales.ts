/** `codegraph` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'nav': '代码索引',
  'title': '代码索引',
  'intro': '索引落在该仓库的 .codegraph/ 目录。Agent 不会替你初始化。',
  'autoInit.label': '自动初始化未索引的工作区',
  'autoInit.help': '打开后，新会话不再询问，宿主会直接对当前工作区运行 codegraph init。',
  'workspace.label': '当前工作区',
  'workspace.none': '当前会话没有工作区',
  'status.indexed': '已建立索引',
  'status.indexing': '正在建立代码索引…',
  'status.missing': '尚未建立索引',
  'action.init': '立即初始化',
  'action.retry': '重试',
  'dock.prompt': '当前工作区还没有代码索引',
  'dock.init': '初始化',
  'dock.dismiss': '忽略',
  'dock.indexing': '正在建立代码索引…',
  'dock.failed': '建立索引失败',
} satisfies Record<string, string>

/** The codegraph namespace key union. */
export type CodegraphKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'nav': 'Code index',
  'title': 'Code index',
  'intro': 'The index lives in this repository’s .codegraph/ directory. The agent will not initialize it for you.',
  'autoInit.label': 'Automatically initialize unindexed workspaces',
  'autoInit.help': 'New sessions skip the prompt, and the host runs codegraph init on the current workspace.',
  'workspace.label': 'Current workspace',
  'workspace.none': 'The current session has no workspace',
  'status.indexed': 'Indexed',
  'status.indexing': 'Building the code index…',
  'status.missing': 'Not indexed yet',
  'action.init': 'Initialize now',
  'action.retry': 'Retry',
  'dock.prompt': 'This workspace has no code index yet',
  'dock.init': 'Initialize',
  'dock.dismiss': 'Dismiss',
  'dock.indexing': 'Building the code index…',
  'dock.failed': 'Failed to build the index',
} satisfies Record<CodegraphKey, string>
