import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated } from '../../common/dto/paginated.js';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import type { ProjectMember } from '../projects/entities/project-member.entity.js';
import { isManager } from '../projects/project-role.enum.js';
import { TasksService } from '../tasks/tasks.service.js';
import {
  type CommentCreatedEvent,
  type CommentDeletedEvent,
  CommentEvents,
} from './comment.events.js';
import type { CreateCommentDto } from './dto/create-comment.dto.js';
import { Comment } from './entities/comment.entity.js';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly comments: Repository<Comment>,
    private readonly tasks: TasksService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    projectId: string,
    taskId: string,
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    // Also checks that the task belongs to this project (no cross-project access).
    const task = await this.tasks.getTaskOrFail(projectId, taskId);

    const saved = await this.comments.save(
      this.comments.create({ taskId, authorId, content: dto.content }),
    );
    const comment = await this.comments.findOneOrFail({
      where: { id: saved.id },
      relations: { author: true },
    });

    const recipientIds = [
      ...new Set([task.assigneeId, task.createdById]),
    ].filter((id): id is string => !!id && id !== authorId);

    const event: CommentCreatedEvent = {
      projectId,
      taskId,
      taskTitle: task.title,
      comment,
      recipientIds,
    };
    this.events.emit(CommentEvents.Created, event);
    return comment;
  }

  async findAll(
    projectId: string,
    taskId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<Comment>> {
    await this.tasks.getTaskOrFail(projectId, taskId);
    const [items, total] = await this.comments.findAndCount({
      where: { taskId },
      relations: { author: true },
      order: { createdAt: 'ASC', id: 'ASC' },
      skip: query.skip,
      take: query.limit,
    });
    return Paginated.of(items, total, query);
  }

  /** The author, or a project owner/admin, may delete a comment. */
  async remove(
    projectId: string,
    taskId: string,
    commentId: string,
    actor: ProjectMember,
  ): Promise<void> {
    await this.tasks.getTaskOrFail(projectId, taskId);
    const comment = await this.comments.findOneBy({ id: commentId, taskId });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== actor.userId && !isManager(actor.role)) {
      throw new ForbiddenException(
        'Only the author or a project owner/admin can delete this comment',
      );
    }
    await this.comments.delete({ id: comment.id });

    const event: CommentDeletedEvent = { projectId, taskId, commentId };
    this.events.emit(CommentEvents.Deleted, event);
  }
}
