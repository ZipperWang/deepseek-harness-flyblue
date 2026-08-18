/** Chinese workspace inspector dictionary. */
export const zh = {
  nav: '文件检查器', title: '文件检查器', intro: '文件预览和变更使用工作区 ID 与版本令牌保护本机文件。',
  loading: '正在加载工作区文件', refresh: '刷新', refreshing: '刷新中…', retry: '重试', error: '无法读取工作区文件',
  workspace: '工作区', noWorkspace: '没有已登记的工作区。',
  searchAria: '搜索文件', searchPlaceholder: '按文件名搜索…',
  searchEmpty: '没有匹配的文件。', treeEmpty: '这个目录是空的。',
  root: '根目录', directory: '目录',
  previewTitle: '预览', previewHint: '在左侧选择一个文件查看内容。', previewLoading: '正在加载预览…',
  truncated: '预览已截断', size: '大小', version: '版本',
} as const

/** English workspace inspector dictionary. */
export const en: Record<keyof typeof zh, string> = {
  nav: 'Workspace inspector', title: 'Workspace inspector', intro: 'File previews and changes use workspace IDs and version tokens to protect local files.',
  loading: 'Loading workspace files', refresh: 'Refresh', refreshing: 'Refreshing…', retry: 'Retry', error: 'Could not read workspace files',
  workspace: 'Workspace', noWorkspace: 'No registered workspace.',
  searchAria: 'Search files', searchPlaceholder: 'Search by file name…',
  searchEmpty: 'No matching files.', treeEmpty: 'This directory is empty.',
  root: 'Root', directory: 'Directory',
  previewTitle: 'Preview', previewHint: 'Select a file on the left to view its content.', previewLoading: 'Loading preview…',
  truncated: 'Preview truncated', size: 'Size', version: 'Version',
}
