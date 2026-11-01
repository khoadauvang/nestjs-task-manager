import {
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { attachmentDisposition } from '../../common/utils/content-disposition.js';
import { CurrentMember } from '../projects/decorators/current-member.decorator.js';
import { ProjectMember } from '../projects/entities/project-member.entity.js';
import { ProjectMemberGuard } from '../projects/guards/project-member.guard.js';
import {
  ALLOWED_ATTACHMENT_TYPE_PATTERN,
  MAX_ATTACHMENT_BYTES,
} from './attachments.constants.js';
import { AttachmentsService } from './attachments.service.js';
import { Attachment } from './entities/attachment.entity.js';

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(ProjectMemberGuard)
@Controller('projects/:projectId/tasks/:taskId/attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @ApiOperation({
    summary: 'Upload a file (PNG, JPEG, GIF, WebP or PDF, max 5 MB)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      // Multer stops reading the request once the limit is reached (413),
      // instead of buffering a huge upload before validation.
      limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
      defParamCharset: 'utf8',
    }),
  )
  upload(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_ATTACHMENT_BYTES }),
          new FileTypeValidator({
            fileType: ALLOWED_ATTACHMENT_TYPE_PATTERN,
            overrideMimeType: true,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<Attachment> {
    return this.attachmentsService.upload(projectId, taskId, user.id, file);
  }

  @ApiOperation({ summary: 'List the files of a task' })
  @Get()
  list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<Attachment[]> {
    return this.attachmentsService.list(projectId, taskId);
  }

  @ApiOperation({ summary: 'Download a file' })
  @ApiProduces('application/octet-stream')
  @Get(':attachmentId/download')
  async download(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ): Promise<StreamableFile> {
    const { attachment, stream } =
      await this.attachmentsService.openForDownload(
        projectId,
        taskId,
        attachmentId,
      );
    return new StreamableFile(stream, {
      type: attachment.mimeType,
      length: attachment.size,
      disposition: attachmentDisposition(attachment.originalName),
    });
  }

  @ApiOperation({ summary: 'Delete a file (uploader, owner or admin)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':attachmentId')
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentMember() actor: ProjectMember,
  ): Promise<void> {
    await this.attachmentsService.remove(
      projectId,
      taskId,
      attachmentId,
      actor,
    );
  }
}
