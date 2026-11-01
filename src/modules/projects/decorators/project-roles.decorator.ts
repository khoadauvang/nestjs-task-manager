import { Reflector } from '@nestjs/core';
import type { ProjectRole } from '../project-role.enum.js';

/**
 * Restricts a route to members with one of the given roles in the project
 * from the URL. Read by ProjectMemberGuard.
 *
 * @example @ProjectRoles([ProjectRole.OWNER])
 */
export const ProjectRoles = Reflector.createDecorator<ProjectRole[]>();
