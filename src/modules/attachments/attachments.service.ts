import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ReadStream } from 'node:fs';
import { Repository } from 'typeorm';
import type { ProjectMember } from '../projects/entities/project-member.entity.js';
import { isManager } from '../projects/project-role.enum.js';
import { TasksService } from '../tasks/tasks.service.js';
import { AttachmentStorage } from './attachment-storage.service.js';
import { ALLOWED_ATTACHMENT_TYPES } from './attachments.constants.js';
import { Attachment } from './entities/attachment.entity.js';

/** Keeps only the last path segment and drops control characters. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/\p{Cc}/gu, '').trim();
  return (cleaned || 'file').slice(0, 255);
}

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachments: Repository<Attachment>,
    private readonly tasks: TasksService,
    private readonly storage: AttachmentStorage,
  ) {}

  async upload(
    projectId: string,
    taskId: string,
    uploadedById: string,
    file: Express.Multer.File,
  ): Promise<Attachment> {
    await this.tasks.getTaskOrFail(projectId, taskId);

    // file.mimetype was replaced with the type detected from the content
    // (FileTypeValidator with overrideMimeType), so it can be trusted here.
    const extension = ALLOWED_ATTACHMENT_TYPES[file.mimetype];
    if (!extension) {
      throw new UnsupportedMediaTypeException('Unsupported file type');
    }

    const storageKey = await this.storage.save(
      projectId,
      taskId,
      file.buffer,
      extension,
    );
    try {
      return await this.attachments.save(
        this.attachments.create({
          taskId,
          uploadedById,
          originalName: sanitizeFileName(file.originalname),
          mimeType: file.mimetype,
          size: file.size,
          storageKey,
        }),
      );
    } catch (error) {
      await this.storage.remove(storageKey); // do not leave orphan files
      throw error;
    }
  }

  async list(projectId: string, taskId: string): Promise<Attachment[]> {
    await this.tasks.getTaskOrFail(projectId, taskId);
    return this.attachments.find({
      where: { taskId },
      relations: { uploadedBy: true },
      order: { createdAt: 'DESC' },
    });
  }

  async openForDownload(
    projectId: string,
    taskId: string,
    attachmentId: string,
  ): Promise<{ attachment: Attachment; stream: ReadStream }> {
    const attachment = await this.getOrFail(projectId, taskId, attachmentId);
    const stream = await this.storage.openReadStream(attachment.storageKey);
    return { attachment, stream };
  }

  /** The uploader, or a project owner/admin, may delete an attachment. */
  async remove(
    projectId: string,
    taskId: string,
    attachmentId: string,
    actor: ProjectMember,
  ): Promise<void> {
    const attachment = await this.getOrFail(projectId, taskId, attachmentId);
    if (attachment.uploadedById !== actor.userId && !isManager(actor.role)) {
      throw new ForbiddenException(
        'Only the uploader or a project owner/admin can delete this file',
      );
    }
    await this.attachments.delete({ id: attachment.id });
    await this.storage.remove(attachment.storageKey);
  }

  private async getOrFail(
    projectId: string,
    taskId: string,
    attachmentId: string,
  ): Promise<Attachment> {
    await this.tasks.getTaskOrFail(projectId, taskId);
    const attachment = await this.attachments.findOneBy({
      id: attachmentId,
      taskId,
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    return attachment;
  }
}
