import type { Comment } from './entities/comment.entity.js';

export const CommentEvents = {
  Created: 'comment.created',
  Deleted: 'comment.deleted',
} as const;

export interface CommentCreatedEvent {
  projectId: string;
  taskId: string;
  taskTitle: string;
  comment: Comment;
  /** Task creator and assignee, minus the comment author. */
  recipientIds: string[];
}

export interface CommentDeletedEvent {
  projectId: string;
  taskId: string;
  commentId: string;
}
