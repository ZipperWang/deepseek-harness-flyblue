/** Durable task-board ledger stored at `$DSH_HOME/task-board/ledger-v2.json`. */
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { writeFileAtomic, withFileLock } from '@deepseek-ai/dsh-atomic-write'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { type TaskId, TaskId as createTaskId, type TaskView } from './types.ts'

export { TaskExecutionId, TaskId } from './types.ts'
export type { TaskView } from './types.ts'
/** Configures scheduler checks. */
export interface Config {
  /** Interval between scheduler checks in milliseconds. */
  tickMs?: number
}
/** Runtime schema for task-board configuration. */
export const Config: z<Config> = z.object({ tickMs: z.natural().min(1_000).default(30_000) })
interface Ledger { version: 2; tasks: TaskView[] }
declare module '@deepseek-ai/cordis' { interface Context { taskBoard: TaskBoardService } }

/**
 * Task service with request-id idempotence and locked ledger publication.
 * @typert service taskBoard
 */
export class TaskBoardService extends TypertRemoteService {
  private readonly path = dshHomePath('task-board', 'ledger-v2.json')
  private ledger: Ledger = { version: 2, tasks: [] }
  private readonly applied = new Map<string, TaskView>()
  private readonly ready: Promise<void>
  /** @param ctx - Host context. @param _config - scheduler configuration. */
  constructor(ctx: Context, _config: Config = {}) { super(ctx, 'taskBoard'); this.ready = this.load() }
  /**
   * Read task-board state.
   * @returns Copies of every durable task in ledger order.
   */
  @Remote
  async list(): Promise<TaskView[]> { await this.ready; return this.ledger.tasks.map(task => ({ ...task })) }
  /**
   * Create a task; repeating the same request id returns the original result.
   * @param title - User-visible task title; surrounding whitespace is removed.
   * @param requestId - Browser-generated idempotency key for this mutation.
   * @returns The created task or the result previously stored for the request id.
   */
  @Remote
  async create(title: string, requestId: string): Promise<TaskView> {
    await this.ready
    const prior = this.applied.get(requestId)
    if (prior !== undefined) return prior
    const now = Date.now()
    const task: TaskView = { id: createTaskId(randomUUID()), title: title.trim(), archived: false, createdAt: now, updatedAt: now }
    if (task.title === '') throw new Error('task-board: task title is required')
    await this.mutate(ledger => ({ ...ledger, tasks: [...ledger.tasks, task] }))
    this.applied.set(requestId, task)
    return task
  }
  /**
   * Archive a task with an idempotent request id.
   * @param id - Durable task to archive.
   * @param requestId - Browser-generated idempotency key for this mutation.
   * @returns The archived task or the result previously stored for the request id.
   */
  @Remote
  async archive(id: TaskId, requestId: string): Promise<TaskView> {
    await this.ready
    const prior = this.applied.get(requestId)
    if (prior !== undefined) return prior
    let changed: TaskView | undefined
    await this.mutate(ledger => ({ ...ledger, tasks: ledger.tasks.map((task) => {
      if (task.id !== id) return task
      changed = { ...task, archived: true, updatedAt: Date.now() }
      return changed
    }) }))
    if (changed === undefined) throw new Error('task-board: unknown task')
    this.applied.set(requestId, changed)
    return changed
  }
  /**
   * Change an active task title through an idempotent browser action.
   * @param id - Durable task to update.
   * @param title - Replacement title; surrounding whitespace is removed.
   * @param requestId - Browser-generated idempotency key for this mutation.
   * @returns The updated task or the result previously stored for the request id.
   */
  @Remote
  async update(id: TaskId, title: string, requestId: string): Promise<TaskView> {
    await this.ready
    const prior = this.applied.get(requestId)
    if (prior !== undefined) return prior
    const value = title.trim()
    if (value === '') throw new Error('task-board: task title is required')
    const changed = await this.change(id, task => ({ ...task, title: value, updatedAt: Date.now() }))
    this.applied.set(requestId, changed)
    return changed
  }
  /**
   * Permanently remove an archived task through an idempotent action.
   * @param id - Archived task to remove.
   * @param requestId - Browser-generated idempotency key for this mutation.
   * @returns The removed task or the result previously stored for the request id.
   */
  @Remote
  async remove(id: TaskId, requestId: string): Promise<TaskView> {
    await this.ready
    const prior = this.applied.get(requestId)
    if (prior !== undefined) return prior
    const task = this.ledger.tasks.find(candidate => candidate.id === id)
    if (task === undefined) throw new Error('task-board: unknown task')
    if (!task.archived) throw new Error('task-board: task must be archived before removal')
    await this.mutate(ledger => ({ ...ledger, tasks: ledger.tasks.filter(candidate => candidate.id !== id) }))
    this.applied.set(requestId, task)
    return task
  }
  private async load(): Promise<void> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.path, 'utf8'))
      if (!isLedger(parsed)) throw new Error('task-board: unsupported ledger format')
      this.ledger = parsed
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  private async mutate(operation: (ledger: Ledger) => Ledger): Promise<void> {
    await withFileLock(this.path, async () => {
      this.ledger = operation(this.ledger)
      await writeFileAtomic(this.path, JSON.stringify(this.ledger), { mode: 0o600, dirMode: 0o700 })
    })
  }
  private async change(id: TaskId, operation: (task: TaskView) => TaskView): Promise<TaskView> {
    let changed: TaskView | undefined
    await this.mutate(ledger => ({ ...ledger, tasks: ledger.tasks.map((task) => {
      if (task.id !== id) return task
      changed = operation(task)
      return changed
    }) }))
    if (changed === undefined) throw new Error('task-board: unknown task')
    return changed
  }
}
function isLedger(value: unknown): value is Ledger { return typeof value === 'object' && value !== null && (value as { version?: unknown }).version === 2 && Array.isArray((value as { tasks?: unknown }).tasks) }
export default TaskBoardService
