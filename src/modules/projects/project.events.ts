import type { ProjectRole } from './project-role.enum.js';

/** Domain events emitted by the projects module (via @nestjs/event-emitter). */
export const ProjectEvents = {
  Deleted: 'project.deleted',
  MemberAdded: 'project.member_added',
  MemberRemoved: 'project.member_removed',
} as const;

export interface ProjectDeletedEvent {
  projectId: string;
  deletedById: string;
}

export interface MemberAddedEvent {
  projectId: string;
  projectName: string;
  userId: string;
  role: ProjectRole;
  addedById: string;
}

export interface MemberRemovedEvent {
  projectId: string;
  userId: string;
  removedById: string;
}
