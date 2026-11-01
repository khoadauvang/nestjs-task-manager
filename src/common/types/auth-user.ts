import type { Request } from 'express';
import type { ProjectMember } from '../../modules/projects/entities/project-member.entity.js';

/** The user attached to a request by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  /** Set by ProjectMemberGuard on routes under /projects/:projectId. */
  projectMember?: ProjectMember;
}
