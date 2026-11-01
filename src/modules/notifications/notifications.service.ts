import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { type FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { Paginated } from '../../common/dto/paginated.js';
import type { ListNotificationsQueryDto } from './dto/list-notifications-query.dto.js';
import { Notification } from './entities/notification.entity.js';
import {
  type NotificationCreatedEvent,
  NotificationEvents,
} from './notification.events.js';
import type { NotificationType } from './notification-type.enum.js';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    private readonly events: EventEmitter2,
  ) {}

  /** Saves one notification per recipient and announces each one (for WebSocket push). */
  async notify(
    recipientIds: string[],
    type: NotificationType,
    data: Record<string, unknown>,
  ): Promise<Notification[]> {
    const unique = [...new Set(recipientIds)];
    if (unique.length === 0) {
      return [];
    }

    const saved = await this.notifications.save(
      unique.map((recipientId) =>
        this.notifications.create({ recipientId, type, data, readAt: null }),
      ),
    );
    for (const notification of saved) {
      const event: NotificationCreatedEvent = { notification };
      this.events.emit(NotificationEvents.Created, event);
    }
    return saved;
  }

  async findForUser(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<Paginated<Notification>> {
    const where: FindOptionsWhere<Notification> = query.unreadOnly
      ? { recipientId: userId, readAt: IsNull() }
      : { recipientId: userId };
    const [items, total] = await this.notifications.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: query.skip,
      take: query.limit,
    });
    return Paginated.of(items, total, query);
  }

  countUnread(userId: string): Promise<number> {
    return this.notifications.countBy({
      recipientId: userId,
      readAt: IsNull(),
    });
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    // Filtering by recipient means another user's notification is simply "not found".
    const notification = await this.notifications.findOneBy({
      id: notificationId,
      recipientId: userId,
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notifications.save(notification);
    }
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.notifications.update(
      { recipientId: userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return result.affected ?? 0;
  }
}
