import type { Notification } from './entities/notification.entity.js';

export const NotificationEvents = {
  Created: 'notification.created',
} as const;

export interface NotificationCreatedEvent {
  notification: Notification;
}
