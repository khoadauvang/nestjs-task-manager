import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module.js';
import { ProjectMember } from './entities/project-member.entity.js';
import { Project } from './entities/project.entity.js';
import { ProjectMembersController } from './project-members.controller.js';
import { ProjectMembersService } from './project-members.service.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectMember]), UsersModule],
  controllers: [ProjectsController, ProjectMembersController],
  providers: [ProjectsService, ProjectMembersService],
  // Exported so other modules can use ProjectMemberGuard on their routes.
  exports: [ProjectMembersService],
})
export class ProjectsModule {}
