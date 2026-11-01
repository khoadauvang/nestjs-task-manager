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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { CurrentMember } from './decorators/current-member.decorator.js';
import { ProjectRoles } from './decorators/project-roles.decorator.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { ProjectMember } from './entities/project-member.entity.js';
import { ProjectMemberGuard } from './guards/project-member.guard.js';
import { ProjectMembersService } from './project-members.service.js';
import { PROJECT_MANAGERS, ProjectRole } from './project-role.enum.js';

@ApiTags('project members')
@ApiBearerAuth()
@UseGuards(ProjectMemberGuard)
@Controller('projects/:projectId/members')
export class ProjectMembersController {
  constructor(private readonly membersService: ProjectMembersService) {}

  @ApiOperation({ summary: 'List members' })
  @Get()
  list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<ProjectMember[]> {
    return this.membersService.list(projectId);
  }

  @ApiOperation({ summary: 'Add an existing user by email (owner or admin)' })
  @ProjectRoles(PROJECT_MANAGERS)
  @Post()
  add(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AddMemberDto,
  ): Promise<ProjectMember> {
    return this.membersService.add(projectId, user.id, dto);
  }

  @ApiOperation({ summary: "Change a member's role (owner)" })
  @ProjectRoles([ProjectRole.OWNER])
  @Patch(':userId')
  updateRole(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<ProjectMember> {
    return this.membersService.updateRole(projectId, userId, dto.role);
  }

  @ApiOperation({
    summary: 'Remove a member, or leave the project by removing yourself',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':userId')
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentMember() actor: ProjectMember,
  ): Promise<void> {
    await this.membersService.remove(projectId, userId, actor);
  }
}
