import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { Paginated } from '../../common/dto/paginated.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto.js';
import { Notification } from './entities/notification.entity.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'List your notifications, newest first' })
  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<Paginated<Notification>> {
    return this.notificationsService.findForUser(user.id, query);
  }

  @ApiOperation({ summary: 'Count your unread notifications' })
  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser): Promise<{ count: number }> {
    return { count: await this.notificationsService.countUnread(user.id) };
  }

  @ApiOperation({ summary: 'Mark every notification as read' })
  @Patch('read-all')
  async markAllRead(
    @CurrentUser() user: AuthUser,
  ): Promise<{ updated: number }> {
    return { updated: await this.notificationsService.markAllRead(user.id) };
  }

  @ApiOperation({ summary: 'Mark one notification as read' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch(':notificationId/read')
  async markRead(
    @CurrentUser() user: AuthUser,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ): Promise<void> {
    await this.notificationsService.markRead(user.id, notificationId);
  }
}
