import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { AttachmentStorage } from './attachment-storage.service.js';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsListener } from './attachments.listener.js';
import { AttachmentsService } from './attachments.service.js';
import { Attachment } from './entities/attachment.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attachment]),
    TasksModule,
    ProjectsModule,
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, AttachmentStorage, AttachmentsListener],
})
export class AttachmentsModule {}
