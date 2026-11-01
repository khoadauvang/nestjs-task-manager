import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Paginated } from '../../common/dto/paginated.js';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';
import type { UpdateProjectDto } from './dto/update-project.dto.js';
import { ProjectMember } from './entities/project-member.entity.js';
import { Project } from './entities/project.entity.js';
import { ProjectEvents, type ProjectDeletedEvent } from './project.events.js';
import { ProjectRole } from './project-role.enum.js';

/** A project as listed for one user, with that user's role in it. */
export type ProjectSummary = Omit<Project, 'members'> & {
  role: ProjectRole;
};

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * The project and its owner membership are written in one transaction:
   * a project can never exist without an owner.
   */
  create(ownerId: string, dto: CreateProjectDto): Promise<Project> {
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.save(
        manager.create(Project, {
          name: dto.name,
          description: dto.description ?? null,
        }),
      );
      await manager.insert(ProjectMember, {
        projectId: project.id,
        userId: ownerId,
        role: ProjectRole.OWNER,
      });
      return project;
    });
  }

  async findAllForUser(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<ProjectSummary>> {
    const [projects, total] = await this.projects
      .createQueryBuilder('project')
      .innerJoinAndSelect(
        'project.members',
        'membership',
        'membership.userId = :userId',
        { userId },
      )
      .orderBy('project.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit)
      .getManyAndCount();

    const items = projects.map(({ members, ...project }) => ({
      ...project,
      role: members?.[0]?.role ?? ProjectRole.MEMBER,
    }));
    return Paginated.of(items, total, query);
  }

  async findOne(projectId: string): Promise<Project> {
    const project = await this.projects.findOne({
      where: { id: projectId },
      relations: { members: { user: true } },
      order: { members: { joinedAt: 'ASC' } },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async update(projectId: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.projects.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (dto.name !== undefined) {
      project.name = dto.name;
    }
    if (dto.description !== undefined) {
      project.description = dto.description;
    }
    return this.projects.save(project);
  }

  /** Members, tasks, comments and attachments are removed by ON DELETE CASCADE. */
  async remove(projectId: string, deletedById: string): Promise<void> {
    await this.projects.delete({ id: projectId });
    const event: ProjectDeletedEvent = { projectId, deletedById };
    this.events.emit(ProjectEvents.Deleted, event);
  }
}
