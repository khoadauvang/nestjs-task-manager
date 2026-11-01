import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated } from '../../common/dto/paginated.js';
import { escapeLike } from '../../common/utils/escape-like.js';
import type { ProjectMember } from '../projects/entities/project-member.entity.js';
import { ProjectMembersService } from '../projects/project-members.service.js';
import { isManager } from '../projects/project-role.enum.js';
import type { CreateTaskDto } from './dto/create-task.dto.js';
import type { ListTasksQueryDto } from './dto/list-tasks-query.dto.js';
import type { UpdateTaskDto } from './dto/update-task.dto.js';
import { Task } from './entities/task.entity.js';
import {
  type TaskAssignedEvent,
  type TaskCreatedEvent,
  type TaskDeletedEvent,
  TaskEvents,
  type TaskUpdatedEvent,
} from './task.events.js';
import { TaskSortField } from './task.enums.js';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    private readonly members: ProjectMembersService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    projectId: string,
    actorId: string,
    dto: CreateTaskDto,
  ): Promise<Task> {
    if (dto.assigneeId) {
      await this.assertAssignable(projectId, dto.assigneeId);
    }

    const saved = await this.tasks.save(
      this.tasks.create({
        projectId,
        title: dto.title,
        description: dto.description ?? null,
        status: dto.status,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assigneeId: dto.assigneeId ?? null,
        createdById: actorId,
      }),
    );
    const task = await this.findOne(projectId, saved.id);

    const created: TaskCreatedEvent = { projectId, task, actorId };
    this.events.emit(TaskEvents.Created, created);
    if (task.assigneeId) {
      this.emitAssigned(task, task.assigneeId, actorId);
    }
    return task;
  }

  async findAll(
    projectId: string,
    query: ListTasksQueryDto,
  ): Promise<Paginated<Task>> {
    const qb = this.tasks
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .where('task.projectId = :projectId', { projectId });

    if (query.status) {
      qb.andWhere('task.status = :status', { status: query.status });
    }
    if (query.priority) {
      qb.andWhere('task.priority = :priority', { priority: query.priority });
    }
    if (query.assigneeId) {
      qb.andWhere('task.assigneeId = :assigneeId', {
        assigneeId: query.assigneeId,
      });
    }
    if (query.search) {
      qb.andWhere('task.title ILIKE :search', {
        search: `%${escapeLike(query.search)}%`,
      });
    }

    // sortBy is validated against an enum, so it is safe to put in ORDER BY.
    qb.orderBy(
      `task.${query.sortBy}`,
      query.order,
      query.sortBy === TaskSortField.DUE_DATE ? 'NULLS LAST' : undefined,
    )
      .addOrderBy('task.id', 'ASC')
      .skip(query.skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    return Paginated.of(items, total, query);
  }

  async findOne(projectId: string, taskId: string): Promise<Task> {
    const task = await this.tasks.findOne({
      where: { id: taskId, projectId },
      relations: { assignee: true, createdBy: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  /**
   * Loads a task without relations. Used before writes: a loaded `assignee`
   * relation would win over a changed `assigneeId` when saving.
   */
  async getTaskOrFail(projectId: string, taskId: string): Promise<Task> {
    const task = await this.tasks.findOneBy({ id: taskId, projectId });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(
    projectId: string,
    taskId: string,
    actorId: string,
    dto: UpdateTaskDto,
  ): Promise<Task> {
    const task = await this.getTaskOrFail(projectId, taskId);
    const assigneeChanged =
      dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId;

    if (assigneeChanged && dto.assigneeId) {
      await this.assertAssignable(projectId, dto.assigneeId);
    }

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.dueDate !== undefined) {
      task.dueDate = dto.dueDate === null ? null : new Date(dto.dueDate);
      task.dueReminderSentAt = null; // a new due date deserves a new reminder
    }
    if (dto.assigneeId !== undefined) task.assigneeId = dto.assigneeId;

    await this.tasks.save(task);
    const updated = await this.findOne(projectId, taskId);

    const event: TaskUpdatedEvent = {
      projectId,
      task: updated,
      actorId,
      changes: Object.keys(dto),
    };
    this.events.emit(TaskEvents.Updated, event);
    if (assigneeChanged && updated.assigneeId) {
      this.emitAssigned(updated, updated.assigneeId, actorId);
    }
    return updated;
  }

  /** The task creator, or a project owner/admin, may delete a task. */
  async remove(
    projectId: string,
    taskId: string,
    actor: ProjectMember,
  ): Promise<void> {
    const task = await this.getTaskOrFail(projectId, taskId);
    if (task.createdById !== actor.userId && !isManager(actor.role)) {
      throw new ForbiddenException(
        'Only the task creator or a project owner/admin can delete this task',
      );
    }
    await this.tasks.delete({ id: task.id });

    const event: TaskDeletedEvent = {
      projectId,
      taskId,
      actorId: actor.userId,
    };
    this.events.emit(TaskEvents.Deleted, event);
  }

  private async assertAssignable(
    projectId: string,
    userId: string,
  ): Promise<void> {
    if (!(await this.members.isMember(projectId, userId))) {
      throw new BadRequestException('Assignee must be a member of the project');
    }
  }

  private emitAssigned(task: Task, assigneeId: string, actorId: string): void {
    const event: TaskAssignedEvent = {
      projectId: task.projectId,
      taskId: task.id,
      taskTitle: task.title,
      assigneeId,
      assignedById: actorId,
    };
    this.events.emit(TaskEvents.Assigned, event);
  }
}
