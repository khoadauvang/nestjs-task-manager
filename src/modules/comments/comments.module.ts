import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';
import { Comment } from './entities/comment.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Comment]), TasksModule, ProjectsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
