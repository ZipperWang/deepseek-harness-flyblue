/** Chinese task board dictionary. */
export const zh = {
  nav: '任务看板', title: '任务看板', intro: '任务看板在宿主上调度并记录任务执行。',
  loading: '正在加载任务', refresh: '刷新', refreshing: '刷新中…', retry: '重试', error: '无法更新任务看板',
  'tab.active': '进行中', 'tab.archived': '已归档',
  'count.active': '进行中 {count}', 'count.archived': '已归档 {count}',
  createAria: '新任务标题', createPlaceholder: '添加一个新任务…', create: '添加任务',
  'empty.active': '还没有任务，创建第一个吧。', 'empty.archived': '没有已归档的任务。',
  rename: '重命名', renameAria: '任务标题', renameSave: '保存', renameCancel: '取消',
  archive: '归档', delete: '删除', deleteConfirm: '确认删除?',
} as const

/** English task board dictionary. */
export const en: Record<keyof typeof zh, string> = {
  nav: 'Task board', title: 'Task board', intro: 'The task board schedules and records host task execution.',
  loading: 'Loading tasks', refresh: 'Refresh', refreshing: 'Refreshing…', retry: 'Retry', error: 'Could not update the task board',
  'tab.active': 'Active', 'tab.archived': 'Archived',
  'count.active': '{count} active', 'count.archived': '{count} archived',
  createAria: 'New task title', createPlaceholder: 'Add a new task…', create: 'Add task',
  'empty.active': 'No tasks yet. Create the first one.', 'empty.archived': 'No archived tasks.',
  rename: 'Rename', renameAria: 'Task title', renameSave: 'Save', renameCancel: 'Cancel',
  archive: 'Archive', delete: 'Delete', deleteConfirm: 'Delete permanently?',
}
