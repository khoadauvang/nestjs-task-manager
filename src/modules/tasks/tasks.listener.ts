import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  type MemberRemovedEvent,
  ProjectEvents,
} from '../projects/project.events.js';
import { Task } from './entities/task.entity.js';

@Injectable()
export class TasksListener {
  constructor(
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
  ) {}

  /** Someone who left a project should not stay assigned to its tasks. */
  @OnEvent(ProjectEvents.MemberRemoved)
  async unassignRemovedMember({
    projectId,
    userId,
  }: MemberRemovedEvent): Promise<void> {
    await this.tasks.update(
      { projectId, assigneeId: userId },
      { assigneeId: null },
    );
  }
}
