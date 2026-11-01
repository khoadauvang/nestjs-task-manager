import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service.js';
import type { AddMemberDto } from './dto/add-member.dto.js';
import { ProjectMember } from './entities/project-member.entity.js';
import { Project } from './entities/project.entity.js';
import {
  type MemberAddedEvent,
  type MemberRemovedEvent,
  ProjectEvents,
} from './project.events.js';
import { ProjectRole } from './project-role.enum.js';

type MemberRef = Pick<ProjectMember, 'userId' | 'role'>;

/**
 * Who may remove whom:
 * - the owner can never be removed;
 * - anyone else may leave the project;
 * - the owner may remove anyone, an admin may remove plain members.
 */
export function canRemoveMember(actor: MemberRef, target: MemberRef): boolean {
  if (target.role === ProjectRole.OWNER) {
    return false;
  }
  if (actor.userId === target.userId) {
    return true;
  }
  if (actor.role === ProjectRole.OWNER) {
    return true;
  }
  return actor.role === ProjectRole.ADMIN && target.role === ProjectRole.MEMBER;
}

@Injectable()
export class ProjectMembersService {
  constructor(
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  findMembership(
    projectId: string,
    userId: string,
  ): Promise<ProjectMember | null> {
    return this.members.findOneBy({ projectId, userId });
  }

  isMember(projectId: string, userId: string): Promise<boolean> {
    return this.members.existsBy({ projectId, userId });
  }

  list(projectId: string): Promise<ProjectMember[]> {
    return this.members.find({
      where: { projectId },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });
  }

  async add(
    projectId: string,
    addedById: string,
    dto: AddMemberDto,
  ): Promise<ProjectMember> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      throw new NotFoundException('No user with this email');
    }
    if (await this.isMember(projectId, user.id)) {
      throw new ConflictException('User is already a member of this project');
    }

    await this.members.insert({ projectId, userId: user.id, role: dto.role });
    const project = await this.projects.findOneByOrFail({ id: projectId });

    const event: MemberAddedEvent = {
      projectId,
      projectName: project.name,
      userId: user.id,
      role: dto.role,
      addedById,
    };
    this.events.emit(ProjectEvents.MemberAdded, event);

    return this.getMemberOrFail(projectId, user.id);
  }

  async updateRole(
    projectId: string,
    userId: string,
    role: ProjectRole,
  ): Promise<ProjectMember> {
    const target = await this.getMemberOrFail(projectId, userId);
    if (target.role === ProjectRole.OWNER) {
      throw new ForbiddenException("The owner's role cannot be changed");
    }
    target.role = role;
    return this.members.save(target);
  }

  async remove(
    projectId: string,
    userId: string,
    actor: ProjectMember,
  ): Promise<void> {
    const target = await this.getMemberOrFail(projectId, userId);
    if (!canRemoveMember(actor, target)) {
      throw new ForbiddenException(
        target.role === ProjectRole.OWNER
          ? 'The project owner cannot be removed'
          : 'You are not allowed to remove this member',
      );
    }

    await this.members.delete({ projectId, userId });
    const event: MemberRemovedEvent = {
      projectId,
      userId,
      removedById: actor.userId,
    };
    this.events.emit(ProjectEvents.MemberRemoved, event);
  }

  private async getMemberOrFail(
    projectId: string,
    userId: string,
  ): Promise<ProjectMember> {
    const member = await this.members.findOne({
      where: { projectId, userId },
      relations: { user: true },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    return member;
  }
}
