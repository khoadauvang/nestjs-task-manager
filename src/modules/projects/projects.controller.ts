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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { ProjectRoles } from './decorators/project-roles.decorator.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { Project } from './entities/project.entity.js';
import { ProjectMemberGuard } from './guards/project-member.guard.js';
import { PROJECT_MANAGERS, ProjectRole } from './project-role.enum.js';
import { ProjectsService, type ProjectSummary } from './projects.service.js';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiOperation({ summary: 'Create a project (you become its owner)' })
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProjectDto,
  ): Promise<Project> {
    return this.projectsService.create(user.id, dto);
  }

  @ApiOperation({ summary: 'List the projects you are a member of' })
  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<ProjectSummary>> {
    return this.projectsService.findAllForUser(user.id, query);
  }

  @ApiOperation({ summary: 'Get a project with its members' })
  @UseGuards(ProjectMemberGuard)
  @Get(':projectId')
  findOne(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<Project> {
    return this.projectsService.findOne(projectId);
  }

  @ApiOperation({ summary: 'Update a project (owner or admin)' })
  @UseGuards(ProjectMemberGuard)
  @ProjectRoles(PROJECT_MANAGERS)
  @Patch(':projectId')
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<Project> {
    return this.projectsService.update(projectId, dto);
  }

  @ApiOperation({ summary: 'Delete a project and everything in it (owner)' })
  @UseGuards(ProjectMemberGuard)
  @ProjectRoles([ProjectRole.OWNER])
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':projectId')
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.projectsService.remove(projectId, user.id);
  }
}
