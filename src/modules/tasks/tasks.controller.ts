import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { Paginated } from '../../common/dto/paginated.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { CurrentMember } from '../projects/decorators/current-member.decorator.js';
import { ProjectMember } from '../projects/entities/project-member.entity.js';
import { ProjectMemberGuard } from '../projects/guards/project-member.guard.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { Task } from './entities/task.entity.js';
import { TasksService } from './tasks.service.js';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(ProjectMemberGuard)
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @ApiOperation({ summary: 'Create a task' })
  @Post()
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTaskDto,
  ): Promise<Task> {
    return this.tasksService.create(projectId, user.id, dto);
  }

  @ApiOperation({ summary: 'List tasks with filters, search and sorting' })
  @Get()
  findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListTasksQueryDto,
  ): Promise<Paginated<Task>> {
    return this.tasksService.findAll(projectId, query);
  }

  @ApiOperation({ summary: 'Get a task' })
  @Get(':taskId')
  findOne(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<Task> {
    return this.tasksService.findOne(projectId, taskId);
  }

  @ApiOperation({ summary: 'Update a task (status, assignee, due date…)' })
  @Patch(':taskId')
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateTaskDto,
  ): Promise<Task> {
    return this.tasksService.update(projectId, taskId, user.id, dto);
  }

  @ApiOperation({ summary: 'Delete a task (creator, owner or admin)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':taskId')
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentMember() actor: ProjectMember,
  ): Promise<void> {
    await this.tasksService.remove(projectId, taskId, actor);
  }
}
