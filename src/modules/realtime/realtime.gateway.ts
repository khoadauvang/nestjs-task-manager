import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { instanceToPlain } from 'class-transformer';
import { isUUID } from 'class-validator';
import type { Namespace, Socket } from 'socket.io';
import type { AuthUser } from '../../common/types/auth-user.js';
import { AccessTokenService } from '../auth/access-token.service.js';
import { extractBearerToken } from '../auth/guards/jwt-auth.guard.js';
import {
  type CommentCreatedEvent,
  type CommentDeletedEvent,
  CommentEvents,
} from '../comments/comment.events.js';
import {
  type NotificationCreatedEvent,
  NotificationEvents,
} from '../notifications/notification.events.js';
import { ProjectMembersService } from '../projects/project-members.service.js';
import {
  type MemberRemovedEvent,
  type ProjectDeletedEvent,
  ProjectEvents,
} from '../projects/project.events.js';
import {
  type TaskCreatedEvent,
  type TaskDeletedEvent,
  TaskEvents,
  type TaskUpdatedEvent,
} from '../tasks/task.events.js';

interface SocketData {
  user: AuthUser;
}
type ClientSocket = Socket<
  Record<string, never>,
  Record<string, (...args: unknown[]) => void>,
  Record<string, never>,
  SocketData
>;

export const projectRoom = (projectId: string): string =>
  `project:${projectId}`;
export const userRoom = (userId: string): string => `user:${userId}`;

/** Reads the access token from `auth: { token }` or an Authorization header. */
function extractSocketToken(socket: Socket): string | null {
  const auth = socket.handshake.auth as { token?: unknown } | undefined;
  if (typeof auth?.token === 'string' && auth.token.length > 0) {
    return auth.token.replace(/^Bearer\s+/i, '');
  }
  return extractBearerToken(socket.handshake.headers.authorization);
}

/**
 * Real-time updates over Socket.IO (namespace /realtime).
 *
 * - Every socket joins its own `user:<id>` room for personal notifications.
 * - Clients join `project:<id>` rooms to receive task and comment events.
 * - Services never talk to this gateway: they emit domain events and the
 *   gateway listens with @OnEvent, so the HTTP side does not depend on sockets.
 */
@WebSocketGateway({ namespace: '/realtime' })
export class RealtimeGateway
  implements OnGatewayInit<Namespace>, OnGatewayConnection<ClientSocket>
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server?: Namespace;

  constructor(
    private readonly accessTokens: AccessTokenService,
    private readonly members: ProjectMembersService,
  ) {}

  /**
   * Authenticates during the handshake. Guards only run for @SubscribeMessage
   * handlers, not for the connection itself, so a middleware is used here.
   * An invalid token rejects the connection (`connect_error` on the client).
   */
  afterInit(namespace: Namespace): void {
    namespace.use((socket, next) => {
      const token = extractSocketToken(socket);
      if (!token) {
        next(new Error('Unauthorized'));
        return;
      }
      this.accessTokens
        .verify(token)
        .then((user) => {
          (socket.data as SocketData).user = user;
          next();
        })
        .catch(() => next(new Error('Unauthorized')));
    });
  }

  async handleConnection(socket: ClientSocket): Promise<void> {
    await socket.join(userRoom(socket.data.user.id));
    this.logger.debug(
      `Socket ${socket.id} connected as ${socket.data.user.id}`,
    );
  }

  @SubscribeMessage('project:join')
  async joinProject(
    @ConnectedSocket() socket: ClientSocket,
    @MessageBody('projectId') projectId: unknown,
  ): Promise<{ joined: string }> {
    if (typeof projectId !== 'string' || !isUUID(projectId)) {
      throw new WsException('projectId must be a UUID');
    }
    if (!(await this.members.isMember(projectId, socket.data.user.id))) {
      throw new WsException('Project not found');
    }
    await socket.join(projectRoom(projectId));
    return { joined: projectId };
  }

  @SubscribeMessage('project:leave')
  async leaveProject(
    @ConnectedSocket() socket: ClientSocket,
    @MessageBody('projectId') projectId: unknown,
  ): Promise<{ left: string }> {
    if (typeof projectId !== 'string' || !isUUID(projectId)) {
      throw new WsException('projectId must be a UUID');
    }
    await socket.leave(projectRoom(projectId));
    return { left: projectId };
  }

  @OnEvent(TaskEvents.Created)
  onTaskCreated({ projectId, task, actorId }: TaskCreatedEvent): void {
    this.toProject(projectId, 'task:created', {
      task: instanceToPlain(task),
      actorId,
    });
  }

  @OnEvent(TaskEvents.Updated)
  onTaskUpdated({ projectId, task, actorId, changes }: TaskUpdatedEvent): void {
    this.toProject(projectId, 'task:updated', {
      task: instanceToPlain(task),
      actorId,
      changes,
    });
  }

  @OnEvent(TaskEvents.Deleted)
  onTaskDeleted({ projectId, taskId, actorId }: TaskDeletedEvent): void {
    this.toProject(projectId, 'task:deleted', { taskId, actorId });
  }

  @OnEvent(CommentEvents.Created)
  onCommentCreated({ projectId, taskId, comment }: CommentCreatedEvent): void {
    this.toProject(projectId, 'comment:created', {
      taskId,
      comment: instanceToPlain(comment),
    });
  }

  @OnEvent(CommentEvents.Deleted)
  onCommentDeleted({
    projectId,
    taskId,
    commentId,
  }: CommentDeletedEvent): void {
    this.toProject(projectId, 'comment:deleted', { taskId, commentId });
  }

  @OnEvent(NotificationEvents.Created)
  onNotificationCreated({ notification }: NotificationCreatedEvent): void {
    this.server
      ?.to(userRoom(notification.recipientId))
      .emit('notification:new', instanceToPlain(notification));
  }

  /** A removed member must stop receiving the project's updates right away. */
  @OnEvent(ProjectEvents.MemberRemoved)
  onMemberRemoved({ projectId, userId }: MemberRemovedEvent): void {
    this.server?.in(userRoom(userId)).socketsLeave(projectRoom(projectId));
  }

  @OnEvent(ProjectEvents.Deleted)
  onProjectDeleted({ projectId }: ProjectDeletedEvent): void {
    this.toProject(projectId, 'project:deleted', { projectId });
    this.server
      ?.in(projectRoom(projectId))
      .socketsLeave(projectRoom(projectId));
  }

  private toProject(projectId: string, event: string, payload: unknown): void {
    this.server?.to(projectRoom(projectId)).emit(event, payload);
  }
}
