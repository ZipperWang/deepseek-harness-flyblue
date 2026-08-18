/** Chinese Git graph dictionary. */
export const zh = {
  nav: 'Git 图谱', title: 'Git 图谱', intro: 'Git 图谱和分支操作只作用于已登记的本机工作区。',
  loading: '正在加载 Git 数据', refresh: '刷新', refreshing: '刷新中…', retry: '重试', error: '无法读取 Git 数据',
  workspace: '工作区', noWorkspace: '没有已登记的工作区。',
  changes: '变更', changesEmpty: '工作区干净，没有变更。',
  staged: '已暂存', unstaged: '未暂存', untracked: '未跟踪', conflict: '冲突',
  stage: '暂存', unstage: '取消暂存', discard: '丢弃', discardConfirm: '确认丢弃?',
  branches: '分支', currentBranch: '当前分支', branchesEmpty: '还没有本地分支。', switch: '切换',
  newBranch: '新建分支', branchPlaceholder: '分支名称', create: '创建',
  history: '提交历史', historyEmpty: '还没有提交。',
  copyHash: '复制完整哈希', copied: '已复制',
} as const

/** English Git graph dictionary. */
export const en: Record<keyof typeof zh, string> = {
  nav: 'Git graph', title: 'Git graph', intro: 'Git graph and branch actions are limited to registered local workspaces.',
  loading: 'Loading Git data', refresh: 'Refresh', refreshing: 'Refreshing…', retry: 'Retry', error: 'Could not read Git data',
  workspace: 'Workspace', noWorkspace: 'No registered workspace.',
  changes: 'Changes', changesEmpty: 'The working tree is clean.',
  staged: 'Staged', unstaged: 'Unstaged', untracked: 'Untracked', conflict: 'Conflict',
  stage: 'Stage', unstage: 'Unstage', discard: 'Discard', discardConfirm: 'Discard changes?',
  branches: 'Branches', currentBranch: 'Current branch', branchesEmpty: 'No local branches yet.', switch: 'Switch',
  newBranch: 'New branch', branchPlaceholder: 'Branch name', create: 'Create',
  history: 'History', historyEmpty: 'No commits yet.',
  copyHash: 'Copy full hash', copied: 'Copied',
}
