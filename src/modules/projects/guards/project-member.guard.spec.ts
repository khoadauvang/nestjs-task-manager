import {
  BadRequestException,
  type ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../../common/types/auth-user.js';
import { ProjectRoles } from '../decorators/project-roles.decorator.js';
import type { ProjectMembersService } from '../project-members.service.js';
import { ProjectRole } from '../project-role.enum.js';
import { ProjectMemberGuard } from './project-member.guard.js';

const PROJECT_ID = '0b9c1f2e-6f4a-4c1d-9a3e-2f8b7c6d5e4f';

class FakeController {
  @ProjectRoles([ProjectRole.OWNER])
  ownerOnly(): void {}

  anyMember(): void {}
}

describe('ProjectMemberGuard', () => {
  const members = { findMembership: vi.fn() };
  const guard = new ProjectMemberGuard(
    new Reflector(),
    members as unknown as ProjectMembersService,
  );

  const contextFor = (
    handler: () => void,
    projectId: string = PROJECT_ID,
  ): { context: ExecutionContext; request: Partial<AuthenticatedRequest> } => {
    const request = {
      params: { projectId },
      user: { id: 'user-1', email: 'u@example.com' },
    } as Partial<AuthenticatedRequest>;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => FakeController,
    } as unknown as ExecutionContext;
    return { context, request };
  };

  beforeEach(() => vi.resetAllMocks());

  it('rejects a malformed project id before touching the database', async () => {
    const { context } = contextFor(FakeController.prototype.anyMember, 'abc');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(members.findMembership).not.toHaveBeenCalled();
  });

  it('answers 404 to non-members so they cannot probe for projects', async () => {
    members.findMembership.mockResolvedValue(null);
    const { context } = contextFor(FakeController.prototype.anyMember);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('answers 403 to members without the required role', async () => {
    members.findMembership.mockResolvedValue({ role: ProjectRole.MEMBER });
    const { context } = contextFor(FakeController.prototype.ownerOnly);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lets members through and exposes their membership', async () => {
    const membership = { userId: 'user-1', role: ProjectRole.OWNER };
    members.findMembership.mockResolvedValue(membership);

    const { context, request } = contextFor(FakeController.prototype.ownerOnly);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.projectMember).toBe(membership);
  });
});
