import { Attachment } from '../modules/attachments/entities/attachment.entity.js';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity.js';
import { Comment } from '../modules/comments/entities/comment.entity.js';
import { Notification } from '../modules/notifications/entities/notification.entity.js';
import { ProjectMember } from '../modules/projects/entities/project-member.entity.js';
import { Project } from '../modules/projects/entities/project.entity.js';
import { Task } from '../modules/tasks/entities/task.entity.js';
import { User } from '../modules/users/entities/user.entity.js';

/**
 * Listed explicitly (no glob) so the same list works in the app, the
 * TypeORM CLI and the tests, whether the code runs as .ts or compiled .js.
 */
export const entities = [
  User,
  RefreshToken,
  Project,
  ProjectMember,
  Task,
  Comment,
  Attachment,
  Notification,
];
