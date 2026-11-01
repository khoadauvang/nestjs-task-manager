import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  type CommentCreatedEvent,
  CommentEvents,
} from '../comments/comment.events.js';
import {
  type MemberAddedEvent,
  ProjectEvents,
} from '../projects/project.events.js';
import {
  type TaskAssignedEvent,
  type TaskDueSoonEvent,
  TaskEvents,
} from '../tasks/task.events.js';
import { NotificationType } from './notification-type.enum.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Turns domain events into notifications. The modules that emit the events
 * do not know this listener exists.
 */
@Injectable()
export class NotificationsListener {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(TaskEvents.Assigned)
  async onTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    if (event.assigneeId === event.assignedById) {
      return; // no notification for assigning a task to yourself
    }
    await this.notifications.notify(
      [event.assigneeId],
      NotificationType.TASK_ASSIGNED,
      {
        projectId: event.projectId,
        taskId: event.taskId,
        taskTitle: event.taskTitle,
        assignedById: event.assignedById,
      },
    );
  }

  @OnEvent(CommentEvents.Created)
  async onCommentCreated(event: CommentCreatedEvent): Promise<void> {
    await this.notifications.notify(
      event.recipientIds,
      NotificationType.COMMENT_ADDED,
      {
        projectId: event.projectId,
        taskId: event.taskId,
        taskTitle: event.taskTitle,
        commentId: event.comment.id,
        authorId: event.comment.authorId,
        authorName: event.comment.author?.name,
        preview: event.comment.content.slice(0, 140),
      },
    );
  }

  @OnEvent(ProjectEvents.MemberAdded)
  async onMemberAdded(event: MemberAddedEvent): Promise<void> {
    await this.notifications.notify(
      [event.userId],
      NotificationType.ADDED_TO_PROJECT,
      {
        projectId: event.projectId,
        projectName: event.projectName,
        role: event.role,
        addedById: event.addedById,
      },
    );
  }

  @OnEvent(TaskEvents.DueSoon)
  async onTaskDueSoon(event: TaskDueSoonEvent): Promise<void> {
    await this.notifications.notify(
      [event.assigneeId],
      NotificationType.TASK_DUE_SOON,
      {
        projectId: event.projectId,
        taskId: event.taskId,
        taskTitle: event.taskTitle,
        dueDate: event.dueDate.toISOString(),
      },
    );
  }
}
