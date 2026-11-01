import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../../../common/types/auth-user.js';
import { ProjectRoles } from '../decorators/project-roles.decorator.js';
import { ProjectMembersService } from '../project-members.service.js';

/**
 * Protects every route under /projects/:projectId.
 *
 * - Non-members get 404, not 403, so they cannot tell whether a project exists.
 * - Members without a role listed in @ProjectRoles() get 403.
 * - The membership is stored on the request for @CurrentMember().
 */
@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly members: ProjectMembersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const projectId = request.params.projectId;

    // Guards run before pipes, so the id has not been validated yet.
    if (typeof projectId !== 'string' || !isUUID(projectId)) {
      throw new BadRequestException('projectId must be a UUID');
    }

    const membership = await this.members.findMembership(
      projectId,
      request.user.id,
    );
    if (!membership) {
      throw new NotFoundException('Project not found');
    }

    const allowedRoles = this.reflector.getAllAndOverride(ProjectRoles, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowedRoles?.length && !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `This action requires one of these project roles: ${allowedRoles.join(', ')}`,
      );
    }

    request.projectMember = membership;
    return true;
  }
}
