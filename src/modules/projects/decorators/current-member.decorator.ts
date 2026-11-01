import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../../common/types/auth-user.js';
import type { ProjectMember } from '../entities/project-member.entity.js';

/** The caller's membership in the project from the URL (set by ProjectMemberGuard). */
export const CurrentMember = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ProjectMember => {
    const member = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().projectMember;
    if (!member) {
      throw new Error('@CurrentMember() requires ProjectMemberGuard');
    }
    return member;
  },
);
