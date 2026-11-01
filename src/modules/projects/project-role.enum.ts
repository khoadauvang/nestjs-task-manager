export enum ProjectRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

/** Roles allowed to edit a project and manage its members. */
export const PROJECT_MANAGERS: ProjectRole[] = [
  ProjectRole.OWNER,
  ProjectRole.ADMIN,
];

/** Roles that can be given through the API (ownership is never handed out). */
export const ASSIGNABLE_ROLES: ProjectRole[] = [
  ProjectRole.ADMIN,
  ProjectRole.MEMBER,
];

export const isManager = (role: ProjectRole): boolean =>
  PROJECT_MANAGERS.includes(role);
