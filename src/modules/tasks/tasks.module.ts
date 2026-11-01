import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module.js';
import { Task } from './entities/task.entity.js';
import { TaskRemindersJob } from './task-reminders.job.js';
import { TasksController } from './tasks.controller.js';
import { TasksListener } from './tasks.listener.js';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Task]), ProjectsModule],
  controllers: [TasksController],
  providers: [TasksService, TasksListener, TaskRemindersJob],
  exports: [TasksService],
})
export class TasksModule {}
