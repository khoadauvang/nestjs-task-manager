import type { Task } from './entities/task.entity.js';

export const TaskEvents = {
  Created: 'task.created',
  Updated: 'task.updated',
  Deleted: 'task.deleted',
  Assigned: 'task.assigned',
  DueSoon: 'task.due_soon',
} as const;

export interface TaskCreatedEvent {
  projectId: string;
  task: Task;
  actorId: string;
}

export interface TaskUpdatedEvent {
  projectId: string;
  task: Task;
  actorId: string;
  /** Names of the fields sent in the update. */
  changes: string[];
}

export interface TaskDeletedEvent {
  projectId: string;
  taskId: string;
  actorId: string;
}

export interface TaskAssignedEvent {
  projectId: string;
  taskId: string;
  taskTitle: string;
  assigneeId: string;
  assignedById: string;
}

export interface TaskDueSoonEvent {
  projectId: string;
  taskId: string;
  taskTitle: string;
  assigneeId: string;
  dueDate: Date;
}
