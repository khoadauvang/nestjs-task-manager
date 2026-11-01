import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  type ProjectDeletedEvent,
  ProjectEvents,
} from '../projects/project.events.js';
import { type TaskDeletedEvent, TaskEvents } from '../tasks/task.events.js';
import { AttachmentStorage } from './attachment-storage.service.js';

/**
 * Database rows are removed by ON DELETE CASCADE; the files on disk are
 * cleaned up here when their task or project is deleted.
 */
@Injectable()
export class AttachmentsListener {
  private readonly logger = new Logger(AttachmentsListener.name);

  constructor(private readonly storage: AttachmentStorage) {}

  @OnEvent(TaskEvents.Deleted)
  async onTaskDeleted({ projectId, taskId }: TaskDeletedEvent): Promise<void> {
    await this.storage.removeTaskFiles(projectId, taskId);
    this.logger.debug(`Removed files of task ${taskId}`);
  }

  @OnEvent(ProjectEvents.Deleted)
  async onProjectDeleted({ projectId }: ProjectDeletedEvent): Promise<void> {
    await this.storage.removeProjectFiles(projectId);
    this.logger.debug(`Removed files of project ${projectId}`);
  }
}
