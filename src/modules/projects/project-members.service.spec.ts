import { canRemoveMember } from './project-members.service.js';
import { ProjectRole } from './project-role.enum.js';

const { OWNER, ADMIN, MEMBER } = ProjectRole;

describe('canRemoveMember', () => {
  it.each([
    // actor role, target role, same person?, allowed?
    [OWNER, ADMIN, false, true],
    [OWNER, MEMBER, false, true],
    [OWNER, OWNER, true, false], // the owner cannot leave their own project
    [ADMIN, MEMBER, false, true],
    [ADMIN, ADMIN, false, false],
    [ADMIN, OWNER, false, false],
    [ADMIN, ADMIN, true, true], // leaving
    [MEMBER, MEMBER, false, false],
    [MEMBER, MEMBER, true, true], // leaving
  ])(
    '%s removing %s (self: %s) -> %s',
    (actorRole, targetRole, isSelf, expected) => {
      const actor = { userId: 'actor', role: actorRole };
      const target = { userId: isSelf ? 'actor' : 'target', role: targetRole };
      expect(canRemoveMember(actor, target)).toBe(expected);
    },
  );
});
