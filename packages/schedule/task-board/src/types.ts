/** Client-safe task-board identifiers and projections. */
import type { Branded } from '@deepseek-ai/dsh-brand'

/** A durable task id. */
export type TaskId = Branded<'TaskId'>

/**
 * Brand a durable task id.
 * @param id - Serialized task identifier.
 * @returns The identifier branded for task-board APIs.
 */
export const TaskId = (id: string): TaskId => id as TaskId

/** A task execution id. */
export type TaskExecutionId = Branded<'TaskExecutionId'>

/**
 * Brand a task execution id.
 * @param id - Serialized execution identifier.
 * @returns The identifier branded for task-execution APIs.
 */
export const TaskExecutionId = (id: string): TaskExecutionId => id as TaskExecutionId

/** Browser task projection. */
export interface TaskView {
  id: TaskId
  title: string
  archived: boolean
  createdAt: number
  updatedAt: number
}
