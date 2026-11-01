import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { CurrentMember } from '../projects/decorators/current-member.decorator.js';
import { ProjectMember } from '../projects/entities/project-member.entity.js';
import { ProjectMemberGuard } from '../projects/guards/project-member.guard.js';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { Comment } from './entities/comment.entity.js';

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(ProjectMemberGuard)
@Controller('projects/:projectId/tasks/:taskId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @ApiOperation({ summary: 'Comment on a task' })
  @Post()
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCommentDto,
  ): Promise<Comment> {
    return this.commentsService.create(projectId, taskId, user.id, dto);
  }

  @ApiOperation({ summary: 'List comments, oldest first' })
  @Get()
  findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<Comment>> {
    return this.commentsService.findAll(projectId, taskId, query);
  }

  @ApiOperation({ summary: 'Delete a comment (author, owner or admin)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':commentId')
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentMember() actor: ProjectMember,
  ): Promise<void> {
    await this.commentsService.remove(projectId, taskId, commentId, actor);
  }
}
